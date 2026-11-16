import { describe, test, expect, beforeEach } from 'vitest'
import * as XLSX from 'xlsx'
import { getDB } from '../db.js'
import { loadDailyReports, saveDailyReports } from '../lib/dailyReportsStorage.js'
import { listCustomers, listFarms, putRaw, getSetting, setSetting } from './store.js'
import { resetAll } from '../test/resetDbs.js'
import {
  buildBackup, parseBackup, restoreBackup, BackupFormatError, FIELDS, backupReminderDays, loadAllData,
} from './backup.js'
import { sheetRows, rowsToSheet } from './xlsxIO.js'

const T1 = '2026-11-16T10:00:00.000Z'
const T2 = '2026-11-16T11:30:00.000Z'

function makeData() {
  return {
    customers: [{ id: 'c1', name: 'Client Démo', nameKey: 'client démo', phone: '0600000001', email: '', region: 'Région Test', address: '', notes: '', createdAt: T1, updatedAt: T1 }],
    farms: [
      { id: 'f1', name: 'مزرعة الأمل', customerId: 'c1', ownerName: '', status: 'customer', lat: 34.518505, lng: -5.622656, locationSource: 'import', locationAccuracy: null, locationStatus: 'ok', region: 'Région Test', address: '', capacity: 40000, notes: 'ملاحظة', createdAt: T1, updatedAt: T2 },
      { id: 'f2', name: 'Prospect X', customerId: null, ownerName: 'Someone', status: 'prospect', lat: null, lng: null, locationSource: null, locationAccuracy: null, locationStatus: 'missing', region: '', address: '', capacity: null, notes: '', createdAt: T1, updatedAt: T1 },
    ],
    orders: [{ id: 7, client: 'Client Démo', customerId: 'c1', desiredDate: '2026-11-20', orderDetails: '40 000 poussins', delivered: false, cancelled: true, createdAt: T1 }],
    dailyReports: [{ id: 'r1', date: '2026-11-15', client: 'Client Démo', customerId: 'c1', notes: 'visite', audio: { name: 'a.webm' } }],
  }
}

const META = { appVersion: '0.8.0', exportedAt: '2026-11-16T12:00:00.000Z' }

function roundTrip(data) {
  const wb = buildBackup(data, META)
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return parseBackup(XLSX.read(buf, { type: 'array' }))
}

function expectSheetsEqual(actual, expected) {
  expect(actual.customers).toEqual(expected.customers)
  expect(actual.farms).toEqual(expected.farms)
  expect(actual.orders).toEqual(expected.orders)
  expect(actual.dailyReports).toEqual(expected.dailyReports)
}

beforeEach(resetAll)

describe('buildBackup / parseBackup', () => {
  test('round-trips exactly through an xlsx byte buffer', () => {
    const data = makeData()
    const out = roundTrip(data)
    expect(out).toMatchObject(data)
    expectSheetsEqual(out, data)
    expect(out.meta).toMatchObject({ schemaVersion: 3, appVersion: '0.8.0', exportedAt: META.exportedAt })
    expect(out.meta.counts).toEqual({ customers: 1, farms: 2, orders: 1, dailyReports: 1 })
  })

  test('numeric-looking strings, whitespace, newlines and Arabic survive byte-identical', () => {
    const data = makeData()
    Object.assign(data.customers[0], {
      id: '00123', phone: '0600000001', email: '  spaced  ', notes: 'line1\nline2\tتاب\r\nend',
      name: 'TRUE', address: '1e5', region: '=SUM(A1)',
    })
    data.farms[0].notes = '  مزرعة  الدجاج \n ٤٠٬٠٠٠ '
    data.orders[0].orderDetails = '0007'
    expectSheetsEqual(roundTrip(data), data)
  })

  test('text the xlsx XML would alter is escaped and restored exactly', () => {
    const tricky = ['a\r\nb', '_x0041_ and _x005F_', 'lone \ud800 high', 'lone \udc00 low', 'non-char ￾￿',
      '<![CDATA[x]]>', '@@esc:abc', '@@blob:0', '\\u0041 literal \r', 'emoji 😀 \x01\x1b', ' ']
    const data = makeData()
    data.customers = tricky.map((notes, i) => ({ ...data.customers[0], id: `c${i}`, notes, address: notes }))
    data.dailyReports[0].audio = { name: tricky.join('|') }
    expectSheetsEqual(roundTrip(data), data)
    // a long escaped string also goes through Blobs
    const long = makeData()
    long.customers[0].notes = 'سطر\r\n'.repeat(20000)
    expectSheetsEqual(roundTrip(long), long)
  })

  test('voice-note data URL of ~100 KB and Arabic notes round-trip via the Blobs sheet', () => {
    const data = makeData()
    let b64 = ''
    while (b64.length < 100000) b64 += 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo0MTIzNDU2Nzg5Ky8='
    const url = `data:audio/webm;base64,${b64}`
    data.dailyReports = [{
      id: 'r1', date: '2026-11-15', client: 'مزرعة الأمل', customerId: 'c1',
      notes: 'زيارة المزرعة '.repeat(3000),
      voiceNotes: [{ url, name: 'recording-2026-11-15T09:00:00.000Z.webm' }],
      createdAt: T1, updatedAt: T2,
    }]
    const wb = buildBackup(data, META)
    expect(wb.SheetNames).toContain('Blobs')
    // no cell anywhere exceeds 32,000 characters
    for (const name of wb.SheetNames) {
      const { rows } = sheetRows(wb, name)
      for (const row of rows) for (const v of row) if (typeof v === 'string') expect(v.length).toBeLessThanOrEqual(32000)
    }
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    const out = parseBackup(XLSX.read(buf, { type: 'array' }))
    expectSheetsEqual(out, data)
    expect(out.dailyReports[0].voiceNotes[0].url).toBe(url)
    expect(out.meta.blobs).toBeGreaterThan(0)
  })

  test('a string that itself looks like a blob reference is not misread', () => {
    const data = makeData()
    data.customers[0].notes = '@@blob:0'
    expectSheetsEqual(roundTrip(data), data)
  })

  test('absent keys, odd types and unknown fields on any sheet survive', () => {
    const data = makeData()
    data.orders.push({ id: 8, client: 'Legacy', orderDetails: 'x', delivered: false, cancelled: false }) // no createdAt, no customerId
    data.orders.push({ id: 9, client: 'Odd', customerId: '', desiredDate: '2026-01-01', orderDetails: 'y', delivered: 'yes', cancelled: false, createdAt: T1, items: [{ product: 'p' }] })
    data.farms[1].capacity = 0
    data.farms[1].lat = 0
    data.farms[1].lng = 0
    data.dailyReports.push({ id: 'r2', date: '2026-11-02', notes: '' }) // no client, no customerId
    expectSheetsEqual(roundTrip(data), data)
  })

  test('empty database round-trips', () => {
    const data = { customers: [], farms: [], orders: [], dailyReports: [] }
    expectSheetsEqual(roundTrip(data), data)
  })

  test('FIELDS lists are the exact ordered lists', () => {
    expect(FIELDS.Customers.map((f) => f.name)).toEqual(['id', 'name', 'nameKey', 'phone', 'email', 'region', 'address', 'notes', 'createdAt', 'updatedAt'])
    expect(FIELDS.Orders.map((f) => `${f.name}:${f.type}`)).toEqual(['id:n', 'client:s', 'customerId:s?', 'desiredDate:s', 'orderDetails:s', 'delivered:b', 'cancelled:b', 'createdAt:s'])
    expect(FIELDS.Farms.find((f) => f.name === 'lat').type).toBe('n?')
  })

  test('booleans are written as boolean cells', () => {
    const wb = buildBackup(makeData(), META)
    const ws = wb.Sheets.Orders
    const { headers } = sheetRows(wb, 'Orders')
    const col = XLSX.utils.encode_col(headers.indexOf('cancelled'))
    expect(ws[`${col}2`]).toMatchObject({ t: 'b', v: true })
    const phoneCol = XLSX.utils.encode_col(sheetRows(wb, 'Customers').headers.indexOf('phone'))
    expect(wb.Sheets.Customers[`${phoneCol}2`]).toMatchObject({ t: 's', v: '0600000001' })
  })

  test('rejects non-backup and wrong schema', () => {
    const plain = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(plain, rowsToSheet(['a'], [['b']]), 'Sheet1')
    expect(() => parseBackup(plain)).toThrow(BackupFormatError)
    try { parseBackup(plain) } catch (e) { expect(e.code).toBe('not-a-backup') }

    const wb = buildBackup(makeData(), META)
    const metaRows = sheetRows(wb, 'Meta')
    const rows = metaRows.rows.map((r) => (r[0] === 'schemaVersion' ? ['schemaVersion', 2] : r))
    wb.Sheets.Meta = rowsToSheet(metaRows.headers, rows)
    expect(() => parseBackup(wb)).toThrow(expect.objectContaining({ code: 'schema' }))
  })

  test('rejects count mismatch and missing blobs', () => {
    const wb = buildBackup(makeData(), META)
    const { headers, rows } = sheetRows(wb, 'Farms')
    wb.Sheets.Farms = rowsToSheet(headers, rows.slice(0, 1))
    expect(() => parseBackup(wb)).toThrow(expect.objectContaining({ code: 'counts' }))

    const data = makeData()
    data.customers[0].notes = 'x'.repeat(70000)
    const wb2 = buildBackup(data, META)
    const blobs = sheetRows(wb2, 'Blobs')
    wb2.Sheets.Blobs = rowsToSheet(blobs.headers, blobs.rows.slice(1))
    expect(() => parseBackup(wb2)).toThrow(BackupFormatError)
  })
})

describe('restoreBackup', () => {
  async function seedExisting() {
    await putRaw('customers', { id: 'c1', name: 'Changed', nameKey: 'changed', phone: '', email: '', region: '', address: '', notes: 'local', createdAt: T2, updatedAt: T2 })
    await putRaw('customers', { id: 'c9', name: 'Local only', nameKey: 'local only', phone: '', email: '', region: '', address: '', notes: '', createdAt: T2, updatedAt: T2 })
    await putRaw('orders', { id: 7, client: 'Local seven', customerId: null, desiredDate: '2026-01-01', orderDetails: 'local', delivered: true, cancelled: false, createdAt: T2 })
    await saveDailyReports([{ id: 'r1', date: '2026-01-01', client: 'local', notes: 'local' }, { id: 'r9', date: '2026-01-02', client: 'x', notes: '' }])
    await setSetting('someOther', 'keep me')
  }

  test('restore replace preserves numeric order id 7 and nulls', async () => {
    await seedExisting()
    const data = roundTrip(makeData())
    const res = await restoreBackup(data, 'replace')
    expect(res.added).toEqual({ customers: 1, farms: 2, orders: 1, dailyReports: 1 })
    const expected = makeData()
    const all = async (s) => (await (await getDB()).getAll(s)).sort((a, b) => String(a.id).localeCompare(String(b.id)))
    expect(await all('customers')).toEqual(expected.customers)
    expect(await all('farms')).toEqual(expected.farms)
    const orders = await (await getDB()).getAll('orders')
    expect(orders).toEqual(expected.orders)
    expect(typeof orders[0].id).toBe('number')
    expect(await loadDailyReports()).toEqual(expected.dailyReports)
    expect(await getSetting('migration.v3')).toBe(true)
    expect(await getSetting('someOther')).toBe('keep me')
    expect(await getSetting('lastBackupAt')).toBe(META.exportedAt)
    // new orders keep auto-incrementing past restored ids
    const db = await getDB()
    const newId = await db.add('orders', { client: 'n', createdAt: T2 })
    expect(newId).toBeGreaterThan(7)
  })

  test('records an index would skip (customer without nameKey) survive export then replace', async () => {
    const noKey = { id: 'c-nokey', name: 'Old record', phone: '0612', notes: 'ملاحظة' }
    await putRaw('customers', noKey)
    await putRaw('customers', makeData().customers[0])
    await putRaw('farms', { id: 'f-odd', name: 'No index fields' })
    expect(await listCustomers()).toHaveLength(1) // the index read misses it
    const source = await loadAllData()
    expect(source.customers).toHaveLength(2)
    const back = roundTrip(source)
    await restoreBackup(back, 'replace')
    const db = await getDB()
    expect(await db.get('customers', 'c-nokey')).toEqual(noKey)
    expect(await db.get('farms', 'f-odd')).toEqual({ id: 'f-odd', name: 'No index fields' })
    expect(await db.getAll('customers')).toHaveLength(2)
  })

  test('add-missing never overwrites', async () => {
    await seedExisting()
    const res = await restoreBackup(roundTrip(makeData()), 'add-missing')
    expect(res.added).toEqual({ customers: 0, farms: 2, orders: 0, dailyReports: 0 })
    expect(res.skipped).toEqual({ customers: 1, farms: 0, orders: 1, dailyReports: 1 })
    const customers = await listCustomers()
    expect(customers.find((c) => c.id === 'c1').name).toBe('Changed')
    expect(customers).toHaveLength(2)
    expect((await getDB().then((db) => db.get('orders', 7))).client).toBe('Local seven')
    const reports = await loadDailyReports()
    expect(reports).toHaveLength(2)
    expect(reports.find((r) => r.id === 'r1').notes).toBe('local')
  })

  test('add-missing adds absent daily reports by id', async () => {
    await saveDailyReports([{ id: 'r9', date: '2026-01-02', client: 'x', notes: '' }])
    const res = await restoreBackup(roundTrip(makeData()), 'add-missing')
    expect(res.added.dailyReports).toBe(1)
    expect((await loadDailyReports()).map((r) => r.id).sort()).toEqual(['r1', 'r9'])
  })

  test('replace refuses invalid data without wiping anything', async () => {
    await seedExisting()
    const bad = roundTrip(makeData())
    bad.orders.push({ ...bad.orders[0] }) // duplicate id
    await expect(restoreBackup(bad, 'replace')).rejects.toBeInstanceOf(BackupFormatError)
    await expect(restoreBackup({ customers: [] }, 'replace')).rejects.toBeInstanceOf(BackupFormatError)
    expect(await listCustomers()).toHaveLength(2)
    expect(await loadDailyReports()).toHaveLength(2)
  })
})

describe('restoreBackup rejects non-finite farm coordinates (M1)', () => {
  for (const [label, lat] of [['NaN', NaN], ['Infinity', Infinity], ['text', '35.4'], ['hand-edited cell', 'abc']]) {
    test(`${label} latitude is rejected with a clear message and nothing is written`, async () => {
      await putRaw('customers', { id: 'c9', name: 'Local only', nameKey: 'local only' })
      const bad = roundTrip(makeData())
      bad.farms[0].lat = lat
      for (const mode of ['replace', 'add-missing']) {
        const err = await restoreBackup(bad, mode).catch((e) => e)
        expect(err).toBeInstanceOf(BackupFormatError)
        expect(err.code).toBe('coordinates')
        expect(err.farmName).toBe('مزرعة الأمل')
        expect(err.message).toContain('مزرعة الأمل')
      }
      expect((await listCustomers()).map((c) => c.id)).toEqual(['c9'])
      expect(await listFarms()).toEqual([])
    })
  }

  test('null / absent coordinates are still accepted', async () => {
    const data = roundTrip(makeData())
    delete data.farms[1].lat
    await expect(restoreBackup(data, 'replace')).resolves.toBeTruthy()
  })
})

describe('backupReminderDays', () => {
  const now = new Date('2026-11-16T12:00:00.000Z')
  test('null when no data or recent backup; days otherwise', () => {
    expect(backupReminderDays({ lastBackupAt: null, hasData: false }, now)).toBeNull()
    expect(backupReminderDays({ lastBackupAt: '2026-11-12T12:00:00.000Z', hasData: true }, now)).toBeNull()
    expect(backupReminderDays({ lastBackupAt: '2026-11-06T12:00:00.000Z', hasData: true }, now)).toBe(10)
    expect(backupReminderDays({ lastBackupAt: undefined, hasData: true }, now)).toBe(Infinity)
  })
})
