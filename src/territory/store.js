import { getDB } from '../db.js'
import { normalizeName, parseCapacity } from './normalize.js'

export class ValidationError extends Error {
  constructor(field, message) {
    super(message || `Invalid ${field}`)
    this.name = 'ValidationError'
    this.field = field
  }
}

const FARM_STATUSES = ['customer', 'prospect', 'competitor']
const LOCATION_SOURCES = ['typed', 'map', 'gps', 'import']

const str = (v) => (v === null || v === undefined ? '' : String(v).trim())

// ---- customers ----

export async function listCustomers() {
  const db = await getDB()
  return db.getAllFromIndex('customers', 'nameKey')
}

export async function getCustomer(id) {
  const db = await getDB()
  return db.get('customers', id)
}

export async function findCustomersByName(name) {
  const db = await getDB()
  return db.getAllFromIndex('customers', 'nameKey', normalizeName(name))
}

export async function saveCustomer(partial) {
  const db = await getDB()
  const existing = partial.id ? await db.get('customers', partial.id) : undefined
  const m = { ...existing, ...partial }
  const name = str(m.name)
  if (!name) throw new ValidationError('name', 'Name is required')
  const now = new Date().toISOString()
  const record = {
    id: existing?.id ?? partial.id ?? crypto.randomUUID(),
    name,
    nameKey: normalizeName(name),
    phone: str(m.phone),
    email: str(m.email),
    region: str(m.region),
    address: str(m.address),
    notes: str(m.notes),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  await db.put('customers', record)
  return record
}

// ---- farms ----

export async function listFarms() {
  const db = await getDB()
  return db.getAll('farms')
}

export async function getFarm(id) {
  const db = await getDB()
  return db.get('farms', id)
}

export async function listFarmsByCustomer(customerId) {
  const db = await getDB()
  return db.getAllFromIndex('farms', 'customerId', customerId)
}

function coord(v) {
  if (v === null || v === undefined || v === '') return null
  return typeof v === 'number' ? v : Number.NaN
}

export async function saveFarm(partial) {
  const db = await getDB()
  const existing = partial.id ? await db.get('farms', partial.id) : undefined
  const m = { ...existing, ...partial }

  const name = str(m.name)
  if (!name) throw new ValidationError('name', 'Name is required')

  const customerId = m.customerId || null
  let status = m.status
  if (status === undefined || status === null || status === '') {
    status = customerId ? 'customer' : 'prospect'
  } else if (!FARM_STATUSES.includes(status)) {
    throw new ValidationError('status', 'Invalid status')
  }
  if (status === 'customer' && !customerId) {
    throw new ValidationError('customerId', 'A customer farm needs a customer')
  }

  const lat = coord(m.lat)
  const lng = coord(m.lng)
  const hasLat = lat !== null
  const hasLng = lng !== null
  if (hasLat !== hasLng) throw new ValidationError('location', 'Latitude and longitude must both be set')
  if (hasLat && !(Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) {
    throw new ValidationError('location', 'Coordinates out of range')
  }
  const locationStatus = !hasLat ? 'missing' : m.locationStatus === 'verify' ? 'verify' : 'ok'

  let locationSource = m.locationSource === undefined || m.locationSource === null || m.locationSource === '' ? null : m.locationSource
  if (locationSource !== null && !LOCATION_SOURCES.includes(locationSource)) {
    throw new ValidationError('locationSource', 'Invalid location source')
  }
  let locationAccuracy = typeof m.locationAccuracy === 'number' ? m.locationAccuracy : null
  if (!hasLat) {
    locationSource = null
    locationAccuracy = null
  }

  let region = str(m.region)
  if (!region && customerId) {
    const c = await db.get('customers', customerId)
    region = str(c?.region)
  }

  const now = new Date().toISOString()
  const record = {
    id: existing?.id ?? partial.id ?? crypto.randomUUID(),
    name,
    customerId,
    ownerName: str(m.ownerName),
    status,
    lat,
    lng,
    locationSource,
    locationAccuracy,
    locationStatus,
    region,
    address: str(m.address),
    capacity: parseCapacity(m.capacity),
    notes: str(m.notes),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  await db.put('farms', record)
  return record
}

export async function deleteFarm(id) {
  const db = await getDB()
  await db.delete('farms', id)
}

// ---- settings ----

export async function getSetting(key) {
  const db = await getDB()
  return (await db.get('settings', key))?.value
}

export async function setSetting(key, value) {
  const db = await getDB()
  await db.put('settings', { key, value })
}

// ---- internal (restore / migration) ----

export async function putRaw(storeName, record) {
  const db = await getDB()
  await db.put(storeName, record)
}

export async function clearStores(storeNames) {
  const db = await getDB()
  const tx = db.transaction(storeNames, 'readwrite')
  await Promise.all([...storeNames.map((n) => tx.objectStore(n).clear()), tx.done])
}
