import { normalizeName, parseNumberLoose, parseCapacity } from './normalize.js'
import { parseCoordinates, haversineKm, hasCoords } from './geo.js'
import { saveCustomer, saveFarm, listCustomers, listFarms } from './store.js'

export const IMPORT_FIELDS = ['customerName', 'customerPhone', 'customerRegion', 'farmName', 'status', 'lat', 'lng', 'coordinates', 'address', 'region', 'capacity', 'notes', 'verify']

const SYNONYMS = {
  customerName: ['client', 'customer', 'nom client', 'propriétaire', 'proprietaire', 'العميل', 'الزبون', 'المالك'],
  customerPhone: ['phone', 'tel', 'téléphone', 'telephone', 'gsm', 'الهاتف'],
  customerRegion: ['client region', 'région client'],
  farmName: ['farm', 'ferme', 'élevage', 'elevage', 'poulailler', 'nom ferme', 'الضيعة', 'المزرعة'],
  status: ['status', 'statut', 'type'],
  lat: ['lat', 'latitude'],
  lng: ['lng', 'lon', 'long', 'longitude'],
  coordinates: ['gps', 'coordonnées', 'coordinates', 'lien', 'link', 'maps', 'localisation', 'location', 'الموقع'],
  address: ['address', 'adresse', 'douar', 'العنوان'],
  region: ['région', 'region', 'province', 'commune', 'المنطقة'],
  capacity: ['capacity', 'capacité', 'capacite', 'poussins', 'effectif', 'السعة'],
  notes: ['notes', 'remarque', 'observations', 'ملاحظات'],
  verify: ['verify', 'vérifier', 'a verifier'],
}

const NEARBY_M = 100

// Headers of this app's own export that must not be guessed as a field
// ("Location status" would otherwise match the coordinates synonym "location").
const IGNORED_HEADERS = ['reference', 'location status', 'statut de localisation']

// Normalised, accent-free text for header and value matching (Arabic is unaffected).
const fold = (s) => normalizeName(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const isEmpty = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
const text = (v) => (isEmpty(v) ? '' : String(v).trim())
const digits = (v) => text(v).replace(/\D/g, '')

function synonymMatches(header, syn) {
  const s = fold(syn)
  // Very short synonyms (lat, tel, gsm...) must be a whole word to avoid "hotel" → phone.
  if (s.length <= 3) return header.split(/[^\p{L}\p{N}]+/u).includes(s)
  return header.includes(s)
}

// Best field for one header: the longest matching synonym wins (so "Région client"
// beats "client" and "région", and "Client" beats "lien"); ties go to field order.
function bestField(header) {
  const h = fold(header)
  if (!h || IGNORED_HEADERS.includes(h)) return null
  let best = null
  let bestLen = 0
  for (const field of IMPORT_FIELDS) {
    for (const syn of SYNONYMS[field]) {
      if (synonymMatches(h, syn) && fold(syn).length > bestLen) {
        best = field
        bestLen = fold(syn).length
      }
    }
  }
  // A header matching both customerRegion and region is a customer region only when it says "client".
  if (best === 'customerRegion' && !h.includes('client')) best = 'region'
  return best
}

export function guessMapping(headers) {
  const mapping = Object.fromEntries(IMPORT_FIELDS.map((f) => [f, null]))
  headers.forEach((header, i) => {
    const field = bestField(header)
    if (field && mapping[field] === null) mapping[field] = i
  })
  return mapping
}

const STATUS_WORDS = {
  customer: ['client', 'cliente', 'customer', 'عميل'],
  prospect: ['prospect', 'prospecte', 'prospect(e)', 'potentiel', 'potentielle'],
  competitor: ['concurrent', 'concurrente', 'competitor', 'منافس'],
}

function parseStatus(v) {
  const s = fold(v)
  if (!s) return 'customer'
  for (const [status, words] of Object.entries(STATUS_WORDS)) {
    if (words.includes(s)) return status
  }
  return null
}

const TRUTHY = ['yes', 'oui', 'x', '1', 'true', 'نعم']
function isTruthy(v) {
  if (v === true) return true
  if (typeof v === 'number') return v === 1
  return TRUTHY.includes(fold(v))
}

const MESSAGES = {
  'no-farm-name': 'No farm name: row skipped',
  'no-customer-name': 'No customer name for a customer farm: row skipped',
  'bad-status': 'Unknown status: row skipped',
  'short-link': 'Short Maps link cannot be read: imported without location',
  'bad-coordinates': 'Coordinates not recognised: imported without location',
  'bad-latlng': 'Latitude/longitude not recognised: used the coordinates column instead',
  'bad-capacity': 'Capacity not recognised: imported without capacity',
}

function validLatLng(lat, lng) {
  return lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

function readLink(raw) {
  if (isEmpty(raw)) return { lat: null, lng: null, empty: true }
  const r = parseCoordinates(raw)
  if (hasCoords(r)) return { lat: r.lat, lng: r.lng }
  return { lat: null, lng: null, error: r.error === 'short-link' ? 'short-link' : 'bad-coordinates' }
}

// Reads coordinates without ever inventing them: valid lat/lng columns win; the
// coordinates column is used when they are empty or invalid. Returns {lat, lng, error?}.
function readCoords(get) {
  const latRaw = get('lat')
  const lngRaw = get('lng')
  if (isEmpty(latRaw) && isEmpty(lngRaw)) {
    const r = readLink(get('coordinates'))
    return r.error ? r : { lat: r.lat, lng: r.lng }
  }
  const lat = parseNumberLoose(latRaw)
  const lng = parseNumberLoose(lngRaw)
  if (validLatLng(lat, lng)) return { lat, lng }
  const r = readLink(get('coordinates'))
  if (r.lat !== null) return { lat: r.lat, lng: r.lng, error: 'bad-latlng' }
  return { lat: null, lng: null, error: 'bad-coordinates' }
}

export function rowsToIncoming(rows, mapping) {
  const customers = []
  const byKey = new Map()
  const rowErrors = []
  const report = (row, code) => rowErrors.push({ row, code, message: MESSAGES[code] })

  rows.forEach((cells, i) => {
    const row = i + 2 // spreadsheet row number (row 1 is the header)
    const get = (field) => {
      const idx = mapping[field]
      return idx === null || idx === undefined || !cells ? null : cells[idx] ?? null
    }
    if (!cells || cells.every(isEmpty)) return

    const farmName = text(get('farmName'))
    if (!farmName) return report(row, 'no-farm-name')
    const status = parseStatus(get('status'))
    if (!status) return report(row, 'bad-status')
    const name = text(get('customerName'))
    if (status === 'customer' && !name) return report(row, 'no-customer-name')

    const phone = text(get('customerPhone'))
    const key = `${status}|${normalizeName(name)}|${digits(phone)}`
    let c = byKey.get(key)
    if (!c) {
      c = { key, name, phone, region: text(get('customerRegion')), status, farms: [] }
      byKey.set(key, c)
      customers.push(c)
    }
    if (!c.region) c.region = text(get('customerRegion'))

    const coords = readCoords(get)
    if (coords.error) report(row, coords.error)
    const capRaw = get('capacity')
    const capacity = isEmpty(capRaw) ? null : parseCapacity(capRaw)
    if (!isEmpty(capRaw) && capacity === null) report(row, 'bad-capacity')
    const located = coords.lat !== null
    c.farms.push({
      row,
      name: farmName,
      lat: coords.lat,
      lng: coords.lng,
      locationStatus: !located ? 'missing' : isTruthy(get('verify')) ? 'verify' : 'ok',
      capacity,
      address: text(get('address')),
      region: text(get('region')),
      notes: text(get('notes')),
      status,
      ownerName: status === 'customer' ? '' : name,
    })
  })

  const { merged, notes } = mergeBlankPhones(customers)

  // Without a customer-region column, a customer's region is its first farm region.
  for (const c of merged) {
    if (!c.region) c.region = c.farms.find((f) => f.region)?.region || ''
  }
  return { customers: merged, rowErrors, notes }
}

// Often only the first row of a customer carries the phone. A blank-phone group
// joins the same-status, same-name group when exactly one phone exists for that
// name; with several phones it is ambiguous, so it stays separate (with a note).
function mergeBlankPhones(customers) {
  const byName = new Map()
  for (const c of customers) {
    const nk = normalizeName(c.name)
    if (!nk) continue
    const k = `${c.status}|${nk}`
    if (!byName.has(k)) byName.set(k, { blank: null, phoned: [] })
    const g = byName.get(k)
    if (digits(c.phone)) g.phoned.push(c)
    else g.blank = c
  }
  const drop = new Set()
  const notes = []
  for (const { blank, phoned } of byName.values()) {
    if (!blank || phoned.length === 0) continue
    if (phoned.length > 1) {
      notes.push({ code: 'blank-phone-ambiguous', name: blank.name, phones: phoned.length, farms: blank.farms.length })
      continue
    }
    const target = phoned[0]
    target.farms = [...target.farms, ...blank.farms].sort((a, b) => a.row - b.row)
    if (!target.region) target.region = blank.region
    // the merged customer takes the earlier of the two positions
    if (customers.indexOf(blank) < customers.indexOf(target)) {
      customers[customers.indexOf(blank)] = target
      drop.add(customers.lastIndexOf(target))
    } else {
      drop.add(customers.indexOf(blank))
    }
  }
  return { merged: customers.filter((_, i) => !drop.has(i)), notes }
}

// Same-name existing customers for each incoming customer. Names are not unique,
// so this only lists candidates: the user must choose for every match.
export function matchCustomers(incoming, existing) {
  const out = []
  for (const c of incoming) {
    if (c.status !== 'customer') continue
    const k = normalizeName(c.name)
    const candidates = existing.filter((e) => (e.nameKey ?? normalizeName(e.name)) === k)
    if (candidates.length) out.push({ key: c.key, candidates })
  }
  return out
}


// ---- conflict detection (indexed: names in a Map, locations in a grid) ----

const CELL_DEG = 0.001 // ≈111 m of latitude, more than NEARBY_M
const NEARBY_DEG_LAT = NEARBY_M / 111195 // 100 m in degrees of latitude (≈0.0009)
const cellOf = (deg) => Math.floor(deg / CELL_DEG)

const existingOwnerKey = (f) => (f.customerId ? `c:${f.customerId}` : `o:${normalizeName(f.ownerName)}`)

// Owner key of an incoming farm. A customer farm belongs to the chosen existing
// customer, or (new customer) to its own incoming group only.
function incomingOwnerKey(f, targetCustomerId, groupKey) {
  if (f.status === 'customer') return targetCustomerId ? `c:${targetCustomerId}` : `n:${groupKey}`
  return `o:${normalizeName(f.ownerName)}`
}

class FarmIndex {
  constructor() {
    this.byName = new Map() // ownerKey \0 nameKey -> entries
    this.grid = new Map() // "i,j" -> entries
    this.size = 0
  }

  add(farm, ownerKey) {
    const entry = { farm, ord: this.size++ }
    const nk = `${ownerKey}\u0000${normalizeName(farm.name)}`
    let list = this.byName.get(nk)
    if (!list) this.byName.set(nk, (list = []))
    list.push(entry)
    if (hasCoords(farm)) {
      const ck = `${cellOf(farm.lat)},${cellOf(farm.lng)}`
      let cell = this.grid.get(ck)
      if (!cell) this.grid.set(ck, (cell = []))
      cell.push(entry)
    }
  }

  sameName(farm, ownerKey) {
    return this.byName.get(`${ownerKey}\u0000${normalizeName(farm.name)}`) || []
  }

  // Entries within NEARBY_M metres, with their rounded distance.
  nearby(farm) {
    if (!hasCoords(farm)) return []
    const ci = cellOf(farm.lat)
    const cj = cellOf(farm.lng)
    const cos = Math.cos(((Math.min(Math.abs(farm.lat) + 0.01, 89.9)) * Math.PI) / 180)
    const span = Math.ceil(NEARBY_DEG_LAT / cos / CELL_DEG)
    const out = []
    for (let i = ci - 1; i <= ci + 1; i++) {
      for (let j = cj - span; j <= cj + span; j++) {
        const cell = this.grid.get(`${i},${j}`)
        if (!cell) continue
        for (const e of cell) {
          const distanceM = Math.round(haversineKm(farm, e.farm) * 1000)
          if (distanceM <= NEARBY_M) out.push({ entry: e, distanceM })
        }
      }
    }
    return out
  }
}

// Core: entries [{farm, ownerKey}] in file order, checked against the existing
// index and against every earlier entry (in-file, marked inFile). Same name only
// counts within the same owner key; 100 m counts across everyone.
function detect(entries, existingIndex) {
  const fileIndex = new FarmIndex()
  const out = []
  for (const { farm, ownerKey } of entries) {
    const found = []
    for (const [index, inFile] of [[existingIndex, false], [fileIndex, true]]) {
      const same = new Set(index.sameName(farm, ownerKey))
      for (const e of same) found.push({ inFile, ord: e.ord, c: { row: farm.row, kind: 'same-name', existing: e.farm } })
      for (const { entry, distanceM } of index.nearby(farm)) {
        if (same.has(entry)) continue
        found.push({ inFile, ord: entry.ord, c: { row: farm.row, kind: 'nearby', existing: entry.farm, distanceM } })
      }
    }
    found.sort((a, b) => (a.inFile - b.inFile) || (a.ord - b.ord))
    for (const x of found) out.push(x.c)
    fileIndex.add({ ...farm, inFile: true }, ownerKey)
  }
  return out
}

function indexExisting(existingFarms) {
  const index = new FarmIndex()
  for (const f of existingFarms) index.add(f, existingOwnerKey(f))
  return index
}

// Conflicts for the farms of ONE incoming customer: same name within the same
// customer (or owner), or within 100 m of any farm. Earlier rows of the same list
// count too (marked inFile).
export function findFarmConflicts(farms, existingFarms, targetCustomerId) {
  const entries = farms.map((farm) => ({ farm, ownerKey: incomingOwnerKey(farm, targetCustomerId, '') }))
  return detect(entries, indexExisting(existingFarms))
}

// Conflicts for a whole import, in row order. In-file 100 m checks cover farms of
// different incoming customers; same-name checks stay per customer / owner.
export function findImportConflicts(incoming, existingFarms, customerDecisions = {}) {
  const entries = []
  for (const c of incoming) {
    const d = customerDecisions[c.key]
    const targetId = c.status === 'customer' && d?.type === 'existing' ? d.customerId : null
    for (const farm of c.farms) entries.push({ farm, ownerKey: incomingOwnerKey(farm, targetId, c.key) })
  }
  entries.sort((a, b) => a.farm.row - b.farm.row)
  return detect(entries, indexExisting(existingFarms))
}

export function groupConflictsByRow(conflicts) {
  const map = new Map()
  for (const c of conflicts) {
    let list = map.get(c.row)
    if (!list) map.set(c.row, (list = []))
    list.push(c)
  }
  return map
}

// The existing farm a row may update, from that row's conflicts: only a same-name
// farm of the same customer, never a nearby farm (that could belong to someone else).
export function updateTarget(rowConflicts) {
  return (rowConflicts || []).find((c) => c.kind === 'same-name' && !c.existing.inFile)?.existing || null
}

export class ImportDecisionError extends Error {
  constructor(key) {
    super('A customer decision is required for every matched customer')
    this.name = 'ImportDecisionError'
    this.key = key
  }
}

// Non-empty incoming fields only. An existing 'verify' flag is kept unless the
// row marks verify or brings different coordinates.
function updatePatch(f, target) {
  const p = {}
  if (f.lat !== null && f.lng !== null) {
    const changed = target.lat !== f.lat || target.lng !== f.lng
    if (changed) {
      Object.assign(p, { lat: f.lat, lng: f.lng, locationStatus: f.locationStatus, locationSource: 'import', locationAccuracy: null })
    } else if (f.locationStatus === 'verify') {
      p.locationStatus = 'verify'
    }
  }
  if (f.capacity !== null && f.capacity !== undefined) p.capacity = f.capacity
  for (const k of ['address', 'region', 'notes']) if (f[k]) p[k] = f[k]
  return p
}

export async function applyImport(incoming, customerDecisions = {}, farmDecisions = {}) {
  const existingCustomers = await listCustomers()
  const existingFarms = await listFarms()
  const matched = new Set(matchCustomers(incoming, existingCustomers).map((m) => m.key))
  const known = new Set(existingCustomers.map((c) => c.id))

  // Check every decision before writing anything.
  for (const c of incoming) {
    if (c.status !== 'customer') continue
    const d = customerDecisions[c.key]
    if (matched.has(c.key) && !d) throw new ImportDecisionError(c.key)
    if (d?.type === 'existing' && !known.has(d.customerId)) throw new ImportDecisionError(c.key)
  }

  const byRow = groupConflictsByRow(findImportConflicts(incoming, existingFarms, customerDecisions))
  const summary = { customersCreated: 0, farmsCreated: 0, farmsUpdated: 0, farmsSkipped: 0, missingLocation: 0, errors: [] }

  for (const c of incoming) {
    const isCustomer = c.status === 'customer'
    const d = customerDecisions[c.key]
    let customerId = isCustomer && d?.type === 'existing' ? d.customerId : null
    for (const f of c.farms) {
      const rowConflicts = byRow.get(f.row)
      const decision = farmDecisions[f.row] ?? (rowConflicts ? 'skip' : 'new')
      const target = decision === 'update' ? updateTarget(rowConflicts) : null
      if (decision === 'skip' || (decision === 'update' && !target)) {
        summary.farmsSkipped++
        continue
      }
      try {
        if (isCustomer && !customerId) {
          customerId = (await saveCustomer({ name: c.name, phone: c.phone, region: c.region })).id
          summary.customersCreated++
        }
        let saved
        if (target) {
          saved = await saveFarm({ id: target.id, ...updatePatch(f, target) })
          summary.farmsUpdated++
        } else {
          saved = await saveFarm({
            name: f.name,
            status: f.status,
            customerId: isCustomer ? customerId : null,
            ownerName: isCustomer ? '' : c.name,
            lat: f.lat,
            lng: f.lng,
            locationStatus: f.locationStatus,
            locationSource: f.lat !== null ? 'import' : null,
            capacity: f.capacity,
            address: f.address,
            region: f.region,
            notes: f.notes,
          })
          summary.farmsCreated++
        }
        if (saved.locationStatus === 'missing') summary.missingLocation++
      } catch (e) {
        if (e?.name !== 'ValidationError') throw e
        summary.farmsSkipped++
        summary.errors.push({ row: f.row, field: e.field, message: e.message })
      }
    }
  }
  return summary
}
