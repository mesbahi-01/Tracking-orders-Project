import { getDB, updateOrder } from '../db.js'
import { loadDailyReports, saveDailyReports } from '../lib/dailyReportsStorage.js'
import { normalizeName } from './normalize.js'
import { findCustomersByName, saveCustomer, getSetting, setSetting } from './store.js'

const FLAG = 'migration.v3'

function localStorageClientNames() {
  const names = []
  const keys = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('clients_')) keys.push(k)
    }
    keys.sort()
  } catch {
    return names
  }
  for (const key of keys) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key))
      if (Array.isArray(parsed)) names.push(...parsed.filter((n) => typeof n === 'string'))
    } catch {
      // ignore unreadable keys; they are left untouched
    }
  }
  return names
}

let inFlight = null

/**
 * Moves the old per-user client name lists into the customers store and links
 * orders and daily reports to customers by id. Safe to re-run: existing
 * customers are reused by normalised name, and nothing is ever deleted.
 * Concurrent calls (e.g. React StrictMode running the effect twice) share one run.
 */
export function runMigrationV3() {
  if (!inFlight) {
    inFlight = migrate().finally(() => { inFlight = null })
  }
  return inFlight
}

async function migrate() {
  if ((await getSetting(FLAG)) === true) return { createdCustomers: 0 }

  // read the whole store: the createdAt index would skip legacy orders without createdAt
  const orders = await (await getDB()).getAll('orders')
  const reports = await loadDailyReports()

  const names = [
    ...localStorageClientNames(),
    ...orders.map((o) => o.client),
    ...reports.map((r) => r.client),
  ]

  const idByKey = new Map()
  let createdCustomers = 0
  for (const raw of names) {
    if (typeof raw !== 'string') continue
    const name = raw.trim()
    const key = normalizeName(name)
    if (!key || idByKey.has(key)) continue
    const existing = await findCustomersByName(name)
    if (existing.length > 0) {
      idByKey.set(key, existing[0].id)
    } else {
      const created = await saveCustomer({ name })
      idByKey.set(key, created.id)
      createdCustomers++
    }
  }

  const idFor = (client) => (typeof client === 'string' ? idByKey.get(normalizeName(client)) : undefined)

  for (const order of orders) {
    if (order.customerId) continue
    const id = idFor(order.client)
    if (id) await updateOrder(order.id, { customerId: id })
  }

  let reportsChanged = false
  const nextReports = reports.map((r) => {
    if (r.customerId) return r
    const id = idFor(r.client)
    if (!id) return r
    reportsChanged = true
    return { ...r, customerId: id }
  })
  if (reportsChanged) await saveDailyReports(nextReports)

  await setSetting(FLAG, true)
  return { createdCustomers }
}
