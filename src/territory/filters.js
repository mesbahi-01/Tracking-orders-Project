import { normalizeName } from './normalize.js'

const hasItems = (a) => Array.isArray(a) && a.length > 0
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

export function applyFarmFilters(farms, customersById = {}, f = {}) {
  const q = f.text ? normalizeName(f.text) : ''
  const region = f.region ? normalizeName(f.region) : ''
  const capMin = isNum(f.capMin) ? f.capMin : null
  const capMax = isNum(f.capMax) ? f.capMax : null

  return farms.filter((farm) => {
    const customer = farm.customerId ? customersById[farm.customerId] : null
    if (f.customerId && farm.customerId !== f.customerId) return false
    if (hasItems(f.statuses) && !f.statuses.includes(farm.status)) return false
    if (hasItems(f.locationStatuses) && !f.locationStatuses.includes(farm.locationStatus)) return false
    if (region && normalizeName(farm.region || customer?.region || '') !== region) return false
    if (capMin !== null || capMax !== null) {
      if (!isNum(farm.capacity)) return false
      if (capMin !== null && farm.capacity < capMin) return false
      if (capMax !== null && farm.capacity > capMax) return false
    }
    if (q) {
      const hay = [farm.name, farm.address, farm.region, farm.notes, customer?.name, farm.ownerName]
        .map((v) => normalizeName(v || ''))
      if (!hay.some((h) => h.includes(q))) return false
    }
    return true
  })
}
