import { haversineKm } from './geo.js'

const TOP_N = 10
const hasCap = (f) => typeof f.capacity === 'number' && Number.isFinite(f.capacity)
const located = (f) => Number.isFinite(f.lat) && Number.isFinite(f.lng)

export function computeStats(customers, farms) {
  const customerById = Object.fromEntries(customers.map((c) => [c.id, c]))
  const farmsByStatus = { customer: 0, prospect: 0, competitor: 0 }
  let needsLocation = 0
  for (const f of farms) {
    if (f.status in farmsByStatus) farmsByStatus[f.status]++
    if (f.locationStatus === 'missing' || f.locationStatus === 'verify') needsLocation++
  }

  const own = farms.filter((f) => f.status === 'customer')
  const known = own.filter(hasCap)
  const totalCapacity = known.reduce((s, f) => s + f.capacity, 0)

  const regions = new Map()
  for (const f of farms) {
    const region = f.region || customerById[f.customerId]?.region || ''
    // capacity stays null until a customer farm of the region has a known capacity
    const r = regions.get(region) || { region, farms: 0, capacity: null }
    r.farms++
    if (f.status === 'customer' && hasCap(f)) r.capacity = (r.capacity ?? 0) + f.capacity
    regions.set(region, r)
  }

  const perCustomer = new Map()
  for (const f of own) {
    const customer = customerById[f.customerId]
    if (!customer) continue
    const c = perCustomer.get(customer.id) || { customer, farms: 0, capacity: 0, unknown: 0 }
    c.farms++
    if (hasCap(f)) c.capacity += f.capacity
    else c.unknown++
    perCustomer.set(customer.id, c)
  }

  return {
    customerCount: customers.length,
    farmCount: farms.length,
    farmsByStatus,
    totalCapacity,
    knownCapacityCount: known.length,
    unknownCapacityCount: own.length - known.length,
    avgCapacity: known.length ? Math.round(totalCapacity / known.length) : null,
    needsLocation,
    byRegion: [...regions.values()].sort((a, b) => (b.capacity ?? -1) - (a.capacity ?? -1)),
    topFarms: [...known].sort((a, b) => b.capacity - a.capacity).slice(0, TOP_N),
    topCustomers: [...perCustomer.values()].filter((c) => c.capacity > 0)
      .sort((a, b) => b.capacity - a.capacity).slice(0, TOP_N),
  }
}

export function prospectsNearCustomers(farms, radiusKm = 10) {
  const customerFarms = farms.filter((f) => f.status === 'customer' && located(f))
  const out = []
  for (const farm of farms) {
    if (farm.status === 'customer' || !located(farm)) continue
    let nearest = null
    let best = Infinity
    for (const c of customerFarms) {
      const d = haversineKm(farm, c)
      if (d < best) { best = d; nearest = c }
    }
    if (nearest && best <= radiusKm) out.push({ farm, nearest, distanceKm: best })
  }
  return out.sort((a, b) => (b.farm.capacity ?? -1) - (a.farm.capacity ?? -1))
}
