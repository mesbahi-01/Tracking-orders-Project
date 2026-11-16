import { normalizeName } from './normalize.js'

// Same-name customers are allowed (spec §2/§5): wherever a customer is shown or
// exported, a name shared with another customer gets its phone and region added.

// Label for pickers: always includes phone and region.
export function customerOptionLabel(c) {
  return [c.name, c.phone, c.region].filter(Boolean).join(' · ')
}

const keyOf = (c) => c.nameKey ?? normalizeName(c.name)

// Returns label(customer): the plain name when unique among `customers`,
// otherwise name · phone · region. Counts are computed once.
export function customerLabeler(customers) {
  const counts = new Map()
  for (const c of customers || []) {
    if (!c) continue
    const k = keyOf(c)
    counts.set(k, (counts.get(k) || 0) + 1)
  }
  return (c) => {
    if (!c) return ''
    return (counts.get(keyOf(c)) || 0) > 1 ? customerOptionLabel(c) : c.name
  }
}

// One-off version of customerLabeler (customer need not be in `all`).
export function customerLabel(customer, all) {
  if (!customer) return ''
  const k = keyOf(customer)
  const dup = (all || []).some((c) => c && c.id !== customer.id && keyOf(c) === k)
  return dup ? customerOptionLabel(customer) : customer.name
}
