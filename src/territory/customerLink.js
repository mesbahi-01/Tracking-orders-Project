import { getDB } from '../db.js'
import { loadDailyReports, saveDailyReports } from '../lib/dailyReportsStorage.js'
import { normalizeName } from './normalize.js'
import {
  findCustomersByName, listCustomers, saveCustomer, getCustomer,
  listFarmsByCustomer, saveFarm, deleteFarm,
} from './store.js'

export async function resolveCustomerByName(name) {
  if (!normalizeName(name || '')) return { status: 'none' }
  const customers = await findCustomersByName(name)
  if (customers.length === 0) return { status: 'none' }
  if (customers.length === 1) return { status: 'one', customer: customers[0] }
  return { status: 'many', customers }
}

/**
 * Form submit helper. Returns the customer id to store for `name`, creating a
 * customer when none matches. With several matches it awaits `pick(customers)`:
 * a customer → its id, null → a new customer, undefined → aborted (returns null).
 */
export async function ensureCustomerId(name, pick) {
  const res = await resolveCustomerByName(name)
  if (res.status === 'one') return res.customer.id
  if (res.status === 'many') {
    const picked = await pick(res.customers)
    if (picked === undefined) return null
    if (picked) return picked.id
  }
  return (await saveCustomer({ name })).id
}

export async function getClientNames() {
  const names = new Set((await listCustomers()).map((c) => c.name))
  return [...names].sort((a, b) => a.localeCompare(b))
}

export async function renameCustomer(id, newName) {
  const customer = await saveCustomer({ id, name: newName })

  const db = await getDB()
  const tx = db.transaction('orders', 'readwrite')
  let cursor = await tx.store.index('customerId').openCursor(IDBKeyRange.only(id))
  while (cursor) {
    cursor.update({ ...cursor.value, client: customer.name })
    cursor = await cursor.continue()
  }
  await tx.done

  const reports = await loadDailyReports()
  if (reports.some((r) => r.customerId === id)) {
    await saveDailyReports(reports.map((r) => (r.customerId === id ? { ...r, client: customer.name } : r)))
  }
  return customer
}

export async function customerUsage(id) {
  const db = await getDB()
  const orders = await db.countFromIndex('orders', 'customerId', id)
  const reports = (await loadDailyReports()).filter((r) => r.customerId === id).length
  return { orders, reports }
}

export async function deleteCustomer(id, farmsAction) {
  if (farmsAction !== 'delete' && farmsAction !== 'prospect') throw new Error(`Invalid farmsAction: ${farmsAction}`)
  const usage = await customerUsage(id)
  if (usage.orders > 0) return { ok: false, reason: 'has-orders' }
  if (usage.reports > 0) return { ok: false, reason: 'has-reports' }

  const customer = await getCustomer(id)
  for (const farm of await listFarmsByCustomer(id)) {
    if (farmsAction === 'prospect') {
      await saveFarm({ ...farm, status: 'prospect', customerId: null, ownerName: customer?.name || farm.ownerName })
    } else {
      await deleteFarm(farm.id)
    }
  }
  const db = await getDB()
  await db.delete('customers', id)
  return { ok: true }
}
