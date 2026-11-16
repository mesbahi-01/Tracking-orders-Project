import { haversineKm, hasCoords } from './geo.js'
import { parseNumberLoose, normalizeName } from './normalize.js'

// Other farms (with coordinates) within radiusM metres of the point, nearest first.
export function findDuplicateFarms(point, farms, { excludeId = null, radiusM = 100 } = {}) {
  if (!hasCoords(point)) return []
  return farms
    .filter((f) => f.id !== excludeId && hasCoords(f))
    .map((f) => ({ farm: f, distanceM: Math.round(haversineKm(point, f) * 1000) }))
    .filter((r) => r.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM)
}

// Form string values -> farm partial for saveFarm. Never invents coordinates:
// both lat and lng must parse, otherwise both are null.
export function formToFarm(v) {
  const lat = parseNumberLoose(v.lat)
  const lng = parseNumberLoose(v.lng)
  const located = lat !== null && lng !== null
  const isCustomer = v.status === 'customer'
  return {
    ...(v.id ? { id: v.id } : {}),
    name: v.name,
    status: v.status,
    customerId: isCustomer ? v.customerId || null : null,
    ownerName: isCustomer ? '' : v.ownerName || '',
    capacity: v.capacity,
    region: v.region,
    address: v.address,
    notes: v.notes,
    lat: located ? lat : null,
    lng: located ? lng : null,
    locationSource: located ? v.locationSource || 'typed' : null,
    locationAccuracy: located && typeof v.locationAccuracy === 'number' ? v.locationAccuracy : null,
    locationStatus: located && v.verify ? 'verify' : located ? 'ok' : 'missing',
  }
}

// Spec §5: a farm name is unique per owner (case/space-insensitive). The owner is the
// customer for customer farms, the owner name for prospects/competitors. Returns the
// other farm with the same normalised name, or null. Farms with no owner are not compared.
export function findSameNameFarm(v, farms) {
  const key = normalizeName(v.name)
  if (!key) return null
  const isCustomer = v.status === 'customer'
  const owner = isCustomer ? v.customerId || '' : normalizeName(v.ownerName)
  if (!owner) return null
  return farms.find((f) => {
    if (f.id === v.id || normalizeName(f.name) !== key) return false
    return isCustomer
      ? f.customerId === owner
      : !f.customerId && f.status !== 'customer' && normalizeName(f.ownerName) === owner
  }) || null
}

// Label for the customer select (moved to customerLabel.js; re-exported for existing imports).
export { customerOptionLabel } from './customerLabel.js'

// Session-only memory of the last GPS fix, used to centre the map picker.
let lastFix = null
export const rememberFix = (p) => { lastFix = { lat: p.lat, lng: p.lng } }
export const getLastFix = () => lastFix

const blank = (v) => v === null || v === undefined || String(v).trim() === ''

// Validates the typed lat/lng fields: null when both empty (location missing) or both valid.
export function locationInputError(latRaw, lngRaw) {
  const bl = blank(latRaw)
  const bg = blank(lngRaw)
  if (bl && bg) return null
  if (bl !== bg) return 'partial'
  const lat = parseNumberLoose(latRaw)
  const lng = parseNumberLoose(lngRaw)
  if (lat === null || lng === null) return 'invalid'
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return 'out-of-range'
  return null
}
