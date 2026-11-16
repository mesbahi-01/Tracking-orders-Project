import { RADII_KM } from './geo.js'
import { normalizeName } from './normalize.js'

export const DEFAULT_RADIUS = 10

export function readNearby(params, savedRadius) {
  const farmId = params.get('farm') || null
  const me = !farmId && params.get('me') === '1'
  const r = Number(params.get('r'))
  let radius = DEFAULT_RADIUS
  if (RADII_KM.includes(r)) radius = r
  else if (RADII_KM.includes(savedRadius)) radius = savedRadius
  return { farmId, me, radius }
}

export function buildNearbyParams({ farmId, me, radius }) {
  const p = new URLSearchParams()
  if (farmId) p.set('farm', farmId)
  else if (me) p.set('me', '1')
  p.set('r', String(radius))
  return p
}

export function nextRadius(radius) {
  const i = RADII_KM.indexOf(radius)
  return i >= 0 && i < RADII_KM.length - 1 ? RADII_KM[i + 1] : null
}

export function searchFarms(farms, customersById, query, limit = 8) {
  const q = normalizeName(query)
  if (!q) return []
  const out = []
  for (const f of farms) {
    const hay = normalizeName(`${f.name || ''} ${customersById[f.customerId]?.name || ''} ${f.ownerName || ''}`)
    if (hay.includes(q)) out.push(f)
    if (out.length >= limit) break
  }
  return out
}
