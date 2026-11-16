import { parseNumberLoose } from './normalize.js'

const EARTH_RADIUS_KM = 6371.0088
const KM_PER_DEG_LAT = 111.195
const NUM = String.raw`-?\d+(?:\.\d+)?`

export const RADII_KM = [5, 10, 20, 30, 50]

const toRad = (d) => (d * Math.PI) / 180

function validate(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { error: 'unrecognized' }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { error: 'out-of-range' }
  return { lat, lng }
}

function fromMatch(m) {
  return m ? validate(parseFloat(m[1]), parseFloat(m[2])) : null
}

function parseDms(s) {
  const re = /(\d+(?:[.,]\d+)?)\s*°\s*(?:(\d+(?:[.,]\d+)?)\s*['′’]\s*)?(?:(\d+(?:[.,]\d+)?)\s*(?:"|″|”|''|′′)\s*)?([NSEW])/gi
  const parts = [...s.matchAll(re)]
  if (parts.length !== 2) return null
  const val = (m) => {
    const sign = /[SW]/i.test(m[4]) ? -1 : 1
    const d = parseNumberLoose(m[1]) + (parseNumberLoose(m[2] || '0') / 60) + (parseNumberLoose(m[3] || '0') / 3600)
    return sign * d
  }
  const [a, b] = parts
  const aIsLat = /[NS]/i.test(a[4])
  const bIsLat = /[NS]/i.test(b[4])
  if (aIsLat === bIsLat) return null
  return aIsLat ? validate(val(a), val(b)) : validate(val(b), val(a))
}

export function parseCoordinates(input) {
  if (input === null || input === undefined) return { error: 'empty' }
  let s = String(input).trim()
  if (!s) return { error: 'empty' }

  if (/(?:^|\/\/)(?:maps\.app\.)?goo\.gl\b/i.test(s)) return { error: 'short-link' }

  let decoded = s
  try { decoded = decodeURIComponent(s) } catch { /* keep raw */ }

  let r =
    fromMatch(decoded.match(new RegExp(String.raw`!3d(${NUM})!4d(${NUM})`))) ||
    fromMatch(decoded.match(new RegExp(String.raw`/place/(${NUM}),\s*(${NUM})`))) ||
    fromMatch(decoded.match(new RegExp(String.raw`@(${NUM}),\s*(${NUM})`))) ||
    fromMatch(decoded.match(new RegExp(String.raw`[?&](?:q|query|ll)=(${NUM}),\s*(${NUM})`)))
  if (r) return r

  r = parseDms(decoded)
  if (r) return r

  const cn = String.raw`-?\d+(?:[.,]\d+)?`
  const semi = decoded.match(new RegExp(String.raw`^(${cn})\s*(?:;|\s)\s*(${cn})$`))
  if (semi) return validate(parseNumberLoose(semi[1]), parseNumberLoose(semi[2]))
  // "34,5" or "34,5185" could be one number with a decimal comma: only accept a comma
  // pair when it is unambiguous (a space after the comma, or a decimal point in both numbers).
  const comma = decoded.match(new RegExp(String.raw`^(${NUM})\s*,(\s*)(${NUM})$`))
  if (comma && (comma[2].length > 0 || (comma[1].includes('.') && comma[3].includes('.')))) {
    return validate(parseFloat(comma[1]), parseFloat(comma[3]))
  }

  return { error: 'unrecognized' }
}

export function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function isInMorocco({ lat, lng }) {
  return lat >= 20.7 && lat <= 35.95 && lng >= -17.2 && lng <= -0.95
}

// The one coordinate check used everywhere: NaN/Infinity/strings are not a position.
export const hasCoords = (f) => !!f && Number.isFinite(f.lat) && Number.isFinite(f.lng)

/**
 * Bounding box [[south, west], [north, east]] of a circle, computed without a map
 * (Leaflet's Circle.getBounds needs the layer to be on a map).
 */
export function circleBounds(center, radiusKm) {
  const dLat = radiusKm / KM_PER_DEG_LAT
  const cos = Math.max(Math.cos(toRad(center.lat)), 1e-6)
  const dLng = radiusKm / (KM_PER_DEG_LAT * cos)
  return [
    [Math.max(-90, center.lat - dLat), center.lng - dLng],
    [Math.min(90, center.lat + dLat), center.lng + dLng],
  ]
}

export function findNearby(origin, farms, radiusKm, opts = {}) {
  const { excludeId, statuses } = opts
  const dLat = radiusKm / KM_PER_DEG_LAT + 1e-9
  const cos = Math.max(Math.cos(toRad(origin.lat)), 1e-6)
  const dLng = radiusKm / (KM_PER_DEG_LAT * cos) + 1e-9
  const results = []
  let missingCount = 0
  for (const farm of farms) {
    if (excludeId !== undefined && farm.id === excludeId) continue
    if (statuses && !statuses.includes(farm.status)) continue
    if (!hasCoords(farm)) { missingCount++; continue }
    if (Math.abs(farm.lat - origin.lat) > dLat || Math.abs(farm.lng - origin.lng) > dLng) continue
    const distanceKm = haversineKm(origin, farm)
    if (distanceKm <= radiusKm) results.push({ farm, distanceKm })
  }
  results.sort((x, y) => x.distanceKm - y.distanceKm)
  return { results, missingCount }
}

export function mapsLinks({ lat, lng }) {
  return {
    view: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    directions: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  }
}
