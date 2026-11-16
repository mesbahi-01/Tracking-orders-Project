const hasCap = (f) => typeof f.capacity === 'number' && Number.isFinite(f.capacity)

// Per-customer totals: farm count (all linked farms), summed known capacity of
// 'customer' farms, and the number of those farms with unknown capacity.
export function customerTotals(farms, customerId) {
  let farmCount = 0
  let capacity = 0
  let unknown = 0
  let known = 0
  for (const f of farms) {
    if (f.customerId !== customerId) continue
    farmCount++
    if (f.status !== 'customer') continue
    if (hasCap(f)) { capacity += f.capacity; known++ }
    else unknown++
  }
  return { farmCount, capacity, unknown, known }
}

export function totalsByCustomer(farms) {
  const map = {}
  for (const f of farms) {
    if (!f.customerId) continue
    if (!map[f.customerId]) map[f.customerId] = customerTotals(farms, f.customerId)
  }
  return map
}
