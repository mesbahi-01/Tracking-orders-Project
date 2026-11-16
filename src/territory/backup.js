import * as XLSX from 'xlsx'
import { version } from '../../package.json'
import { getDB } from '../db.js'
import { loadDailyReports, saveDailyReports } from '../lib/dailyReportsStorage.js'
import { setSetting } from './store.js'
import { sheetRows, rowsToSheet, downloadBuffer } from './xlsxIO.js'

export const SCHEMA_VERSION = 3
export const MAX_CELL = 32000
const BLOB_PREFIX = '@@blob:'
const EXTRA = 'extra'
const ABSENT = '@absent' // fixed fields missing from the record
const RAW = '@raw' // fixed fields whose value does not fit the column type

export class BackupFormatError extends Error {
  constructor(code, message) {
    super(message || `Backup format error: ${code}`)
    this.name = 'BackupFormatError'
    this.code = code
  }
}

// A restore that wrote part of the data (code 'reports-partial').
export class RestoreError extends Error {
  constructor(code, message) {
    super(message || `Restore error: ${code}`)
    this.name = 'RestoreError'
    this.code = code
  }
}

const f = (spec) => spec.split(' ').map((p) => {
  const [name, type] = p.split(':')
  return { name, type }
})

// Ordered fields per sheet. s: string, s?: nullable string, n: number, n?: nullable number, b: boolean.
export const FIELDS = {
  Customers: f('id:s name:s nameKey:s phone:s email:s region:s address:s notes:s createdAt:s updatedAt:s'),
  Farms: f('id:s name:s customerId:s? ownerName:s status:s lat:n? lng:n? locationSource:s? locationAccuracy:n? locationStatus:s region:s address:s capacity:n? notes:s createdAt:s updatedAt:s'),
  Orders: f('id:n client:s customerId:s? desiredDate:s orderDetails:s delivered:b cancelled:b createdAt:s'),
  DailyReports: f('id:s date:s client:s customerId:s? notes:s'),
}

// sheet name -> data key
export const SHEETS = { Customers: 'customers', Farms: 'farms', Orders: 'orders', DailyReports: 'dailyReports' }
const STORES = { customers: 'customers', farms: 'farms', orders: 'orders' }

// ---- typing ----

function conforms(type, v) {
  switch (type) {
    case 's': return typeof v === 'string'
    case 's?': return v === null || (typeof v === 'string' && v !== '')
    case 'n': return typeof v === 'number' && Number.isFinite(v)
    case 'n?': return v === null || (typeof v === 'number' && Number.isFinite(v))
    case 'b': return typeof v === 'boolean'
    default: return false
  }
}

function fromCell(type, v) {
  const empty = v === null || v === undefined || v === ''
  switch (type) {
    case 's': return empty ? '' : String(v)
    case 's?': return empty ? null : String(v)
    case 'n': return empty ? null : typeof v === 'number' ? v : Number(v)
    case 'n?': return empty ? null : typeof v === 'number' ? v : Number(v)
    case 'b': return v === true || v === 1 || (typeof v === 'string' && v.toUpperCase() === 'TRUE')
    default: return v
  }
}

function encodeRecord(record, fields) {
  const known = new Set(fields.map((x) => x.name))
  const cells = []
  const extra = {}
  const absent = []
  const raw = {}
  for (const { name, type } of fields) {
    const v = record[name]
    if (v === undefined) {
      absent.push(name)
      cells.push(null)
    } else if (conforms(type, v)) {
      cells.push(v)
    } else {
      raw[name] = v
      cells.push(typeof v === 'object' && v !== null ? null : v === '' ? null : String(v))
    }
  }
  for (const k of Object.keys(record)) {
    if (!known.has(k) && record[k] !== undefined) extra[k] = record[k]
  }
  if (absent.length) extra[ABSENT] = absent
  if (Object.keys(raw).length) extra[RAW] = raw
  cells.push(Object.keys(extra).length ? JSON.stringify(extra) : null)
  return cells
}

function decodeRow(row, fields, index) {
  const rec = {}
  for (const { name, type } of fields) rec[name] = fromCell(type, row[index[name]])
  const extraCell = row[index[EXTRA]]
  if (extraCell !== null && extraCell !== undefined && extraCell !== '') {
    let extra
    try {
      extra = JSON.parse(String(extraCell))
    } catch {
      throw new BackupFormatError('extra', 'Unreadable extra column')
    }
    const { [ABSENT]: absent, [RAW]: raw, ...rest } = extra
    Object.assign(rec, rest)
    if (raw) Object.assign(rec, raw)
    if (Array.isArray(absent)) for (const k of absent) delete rec[k]
  }
  return rec
}

// ---- blobs (cells longer than Excel's limit) ----

function splitParts(text) {
  const parts = []
  let i = 0
  while (i < text.length) {
    let end = Math.min(i + MAX_CELL, text.length)
    // never split a surrogate pair
    if (end < text.length) {
      const code = text.charCodeAt(end - 1)
      if (code >= 0xd800 && code <= 0xdbff) end -= 1
    }
    parts.push(text.slice(i, end))
    i = end
  }
  return parts
}

// Some text does not survive the XML inside an .xlsx (CRLF becomes LF, literal
// "_x0041_" is decoded to "A", lone surrogates and U+FFFE/U+FFFF become U+FFFD,
// CDATA markers are stripped). Such strings, and any string starting with the
// reserved "@@", are stored escaped as "@@esc:..." and unescaped on read.
const ESC_PREFIX = '@@esc:'
const UNSAFE = /\r|_x[0-9A-Fa-f]{4}_|<!\[CDATA\[|[￾￿]|^@@/
const ESC_CHARS = /[\\\r_<\uD800-\uDFFF￾￿]/g

// No regex lookbehind (unsupported on older engines): scan for lone surrogates.
function hasLoneSurrogate(v) {
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i)
    if (c >= 0xd800 && c <= 0xdbff) {
      const n = v.charCodeAt(i + 1)
      if (n >= 0xdc00 && n <= 0xdfff) i++
      else return true
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      return true
    }
  }
  return false
}

function escapeCell(v) {
  if (!UNSAFE.test(v) && !hasLoneSurrogate(v)) return v
  return ESC_PREFIX + v.replace(ESC_CHARS, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

function unescapeCell(v) {
  if (typeof v !== 'string' || !v.startsWith(ESC_PREFIX)) return v
  return v.slice(ESC_PREFIX.length).replace(/\\u([0-9a-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

function makeBlobber() {
  const rows = []
  let next = 0
  const put = (v) => {
    if (typeof v !== 'string') return v
    v = escapeCell(v)
    if (v.length <= MAX_CELL) return v
    const key = String(next++)
    splitParts(v).forEach((text, part) => rows.push([key, part, text]))
    return BLOB_PREFIX + key
  }
  return { put, rows }
}

function readBlobs(wb) {
  const { headers, rows } = sheetRows(wb, 'Blobs')
  const ki = headers.indexOf('key')
  const pi = headers.indexOf('part')
  const ti = headers.indexOf('text')
  if (rows.length && (ki < 0 || pi < 0 || ti < 0)) throw new BackupFormatError('blobs', 'Blobs sheet is missing columns')
  const groups = new Map()
  for (const r of rows) {
    const key = String(r[ki])
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push([Number(r[pi]), r[ti] === null || r[ti] === undefined ? '' : String(r[ti])])
  }
  const map = new Map()
  for (const [key, parts] of groups) {
    parts.sort((a, b) => a[0] - b[0])
    parts.forEach(([p], i) => {
      if (p !== i) throw new BackupFormatError('blobs', `Blob ${key} is missing part ${i}`)
    })
    map.set(key, parts.map(([, t]) => t).join(''))
  }
  return { map, count: rows.length }
}

// ---- workbook ----

export function buildBackup({ customers = [], farms = [], orders = [], dailyReports = [] }, { appVersion, exportedAt }) {
  const data = { customers, farms, orders, dailyReports }
  const wb = XLSX.utils.book_new()
  const blobber = makeBlobber()
  const sheets = []
  for (const [sheet, key] of Object.entries(SHEETS)) {
    const fields = FIELDS[sheet]
    const rows = data[key].map((rec) => encodeRecord(rec, fields).map(blobber.put))
    sheets.push([sheet, rowsToSheet([...fields.map((x) => x.name), EXTRA], rows)])
  }
  const metaRows = [
    ['schemaVersion', SCHEMA_VERSION],
    ['appVersion', blobber.put(String(appVersion ?? ''))],
    ['exportedAt', blobber.put(String(exportedAt ?? ''))],
    ...Object.entries(SHEETS).map(([sheet, key]) => [`count.${sheet}`, data[key].length]),
    ['count.Blobs', blobber.rows.length],
  ]
  XLSX.utils.book_append_sheet(wb, rowsToSheet(['key', 'value'], metaRows), 'Meta')
  for (const [name, ws] of sheets) XLSX.utils.book_append_sheet(wb, ws, name)
  if (blobber.rows.length) XLSX.utils.book_append_sheet(wb, rowsToSheet(['key', 'part', 'text'], blobber.rows), 'Blobs')
  return wb
}

export function parseBackup(wb) {
  if (!wb?.Sheets?.Meta) throw new BackupFormatError('not-a-backup', 'This file is not a backup (no Meta sheet)')
  const metaMap = {}
  for (const [k, v] of sheetRows(wb, 'Meta').rows) if (k !== null && k !== undefined) metaMap[String(k)] = v
  if (!('schemaVersion' in metaMap)) throw new BackupFormatError('not-a-backup', 'This file is not a backup')
  if (Number(metaMap.schemaVersion) !== SCHEMA_VERSION) throw new BackupFormatError('schema', `Unsupported backup schema ${metaMap.schemaVersion}`)

  const blobs = readBlobs(wb)
  const metaCount = (name) => {
    const n = Number(metaMap[`count.${name}`] ?? 0)
    if (!Number.isInteger(n) || n < 0) throw new BackupFormatError('counts', `Bad count for ${name}`)
    return n
  }
  if (blobs.count !== metaCount('Blobs')) throw new BackupFormatError('counts', 'Blobs count does not match')
  const resolve = (v) => {
    if (typeof v !== 'string') return v
    if (v.startsWith(BLOB_PREFIX)) {
      const key = v.slice(BLOB_PREFIX.length)
      if (!blobs.map.has(key)) throw new BackupFormatError('blobs', `Missing blob ${key}`)
      v = blobs.map.get(key)
    }
    return unescapeCell(v)
  }

  const out = {}
  const counts = {}
  for (const [sheet, key] of Object.entries(SHEETS)) {
    const fields = FIELDS[sheet]
    const expected = metaCount(sheet)
    if (!wb.Sheets[sheet]) {
      if (expected !== 0) throw new BackupFormatError('counts', `Sheet ${sheet} is missing`)
      out[key] = []
      counts[key] = 0
      continue
    }
    const { headers, rows } = sheetRows(wb, sheet)
    const index = {}
    for (const name of [...fields.map((x) => x.name), EXTRA]) {
      const i = headers.indexOf(name)
      if (i < 0) throw new BackupFormatError('columns', `Sheet ${sheet} has no column ${name}`)
      index[name] = i
    }
    if (rows.length !== expected) throw new BackupFormatError('counts', `Sheet ${sheet} has ${rows.length} rows, Meta says ${expected}`)
    out[key] = rows.map((row) => decodeRow(row.map(resolve), fields, index))
    counts[key] = rows.length
  }

  out.meta = {
    schemaVersion: SCHEMA_VERSION,
    appVersion: metaMap.appVersion === null || metaMap.appVersion === undefined ? '' : String(resolve(metaMap.appVersion)),
    exportedAt: metaMap.exportedAt === null || metaMap.exportedAt === undefined ? '' : String(resolve(metaMap.exportedAt)),
    counts,
    blobs: blobs.count,
  }
  return out
}

// ---- validation before any write ----

// A farm position is either absent/null or a finite number: NaN, Infinity or text
// (e.g. a hand-edited cell) would put a farm nowhere, or crash the map.
function checkFarmCoords(farm) {
  for (const k of ['lat', 'lng']) {
    const v = farm[k]
    if (v === null || v === undefined || Number.isFinite(v)) continue
    const name = typeof farm.name === 'string' && farm.name ? farm.name : String(farm.id)
    const err = new BackupFormatError('coordinates', `Farm "${name}" has an invalid ${k === 'lat' ? 'latitude' : 'longitude'}: ${String(v)}`)
    err.farmName = name
    throw err
  }
}

function validateData(data) {
  if (!data || typeof data !== 'object') throw new BackupFormatError('invalid', 'No backup data')
  for (const key of Object.values(SHEETS)) {
    const list = data[key]
    if (!Array.isArray(list)) throw new BackupFormatError('invalid', `Missing ${key}`)
    if (data.meta?.counts && data.meta.counts[key] !== list.length) throw new BackupFormatError('counts', `${key} count does not match`)
    const seen = new Set()
    for (const rec of list) {
      if (!rec || typeof rec !== 'object') throw new BackupFormatError('invalid', `Bad record in ${key}`)
      const id = rec.id
      const ok = key === 'orders' ? typeof id === 'number' && Number.isFinite(id) : typeof id === 'string' && id !== ''
      if (!ok) throw new BackupFormatError('invalid', `Bad id in ${key}`)
      if (seen.has(id)) throw new BackupFormatError('invalid', `Duplicate id ${id} in ${key}`)
      seen.add(id)
      if (key === 'farms') checkFarmCoords(rec)
    }
  }
}

// ---- restore ----

export async function restoreBackup(data, mode) {
  if (mode !== 'replace' && mode !== 'add-missing') throw new Error(`Unknown restore mode ${mode}`)
  validateData(data)
  const added = { customers: 0, farms: 0, orders: 0, dailyReports: 0 }
  const skipped = { customers: 0, farms: 0, orders: 0, dailyReports: 0 }
  const storeKeys = Object.keys(STORES)

  const db = await getDB()
  // One transaction: if anything fails, nothing in orders-db changes.
  const tx = db.transaction([...storeKeys.map((k) => STORES[k]), 'settings'], 'readwrite')
  const ops = []
  if (mode === 'replace') {
    for (const key of storeKeys) {
      const store = tx.objectStore(STORES[key])
      ops.push(store.clear())
      for (const rec of data[key]) ops.push(store.put(rec))
      added[key] = data[key].length
    }
    const settings = tx.objectStore('settings')
    ops.push(settings.put({ key: 'migration.v3', value: true }))
  } else {
    for (const key of storeKeys) {
      const store = tx.objectStore(STORES[key])
      const existing = new Set(await store.getAllKeys())
      for (const rec of data[key]) {
        if (existing.has(rec.id)) {
          skipped[key]++
        } else {
          ops.push(store.put(rec))
          added[key]++
        }
      }
    }
  }
  await Promise.all([...ops, tx.done])

  if (mode === 'replace') {
    try {
      await saveDailyReports(data.dailyReports)
    } catch (e) {
      throw new RestoreError('reports-partial', `Customers, farms and orders were restored but daily reports were not: ${e?.message || e}`)
    }
    added.dailyReports = data.dailyReports.length
    // only once everything is written does this phone match the backup
    if (data.meta?.exportedAt) await setSetting('lastBackupAt', data.meta.exportedAt)
  } else {
    const current = await loadDailyReports()
    const ids = new Set(current.map((r) => r.id))
    const extra = []
    for (const r of data.dailyReports) {
      if (ids.has(r.id)) skipped.dailyReports++
      else extra.push(r)
    }
    if (extra.length) {
      await saveDailyReports([...current, ...extra])
      added.dailyReports = extra.length
    }
  }
  return { added, skipped }
}

// ---- export ----

function canonical(v) {
  return JSON.stringify(v, (_, x) => {
    if (x && typeof x === 'object' && !Array.isArray(x)) {
      return Object.keys(x).sort().reduce((o, k) => { o[k] = x[k]; return o }, {})
    }
    return x
  })
}

function localDate(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Full-store reads: index reads (e.g. listCustomers via nameKey) skip records
// whose indexed field is missing, and a backup must never leave anything out.
export async function loadAllData() {
  const db = await getDB()
  const [customers, farms, orders] = await Promise.all(['customers', 'farms', 'orders'].map((s) => db.getAll(s)))
  const dailyReports = await loadDailyReports()
  return { customers, farms, orders, dailyReports }
}

export async function exportFullBackup() {
  const data = await loadAllData()
  const now = new Date()
  const exportedAt = now.toISOString()
  const wb = buildBackup(data, { appVersion: version, exportedAt })
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  // Verify the file reads back to exactly the same data before handing it over.
  const back = parseBackup(XLSX.read(buf, { type: 'array' }))
  for (const key of Object.values(SHEETS)) {
    if (canonical(back[key]) !== canonical(data[key])) throw new BackupFormatError('verify', `Backup verification failed for ${key}`)
  }
  const filename = `farm-backup-${localDate(now)}.xlsx`
  downloadBuffer(buf, filename)
  await setSetting('lastBackupAt', exportedAt)
  return { filename, counts: back.meta.counts }
}

export { getBackupStatus, backupAgeDays, backupReminderDays } from './backupStatus.js'
