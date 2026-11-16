import { test, expect, beforeEach } from 'vitest'
import { addOrder, getAllOrders } from '../db.js'
import { loadDailyReports, saveDailyReports } from '../lib/dailyReportsStorage.js'
import { saveCustomer, saveFarm, getCustomer, listFarms, listFarmsByCustomer } from './store.js'
import {
  resolveCustomerByName, getClientNames, renameCustomer, customerUsage, deleteCustomer,
} from './customerLink.js'
import * as clients from '../clients.js'
import { resetAll } from '../test/resetDbs.js'

beforeEach(resetAll)

test('resolveCustomerByName none/one/many', async () => {
  expect(await resolveCustomerByName('Nobody')).toEqual({ status: 'none' })
  expect(await resolveCustomerByName('   ')).toEqual({ status: 'none' })
  const a = await saveCustomer({ name: 'Solo Client' })
  const one = await resolveCustomerByName('  solo   CLIENT ')
  expect(one.status).toBe('one')
  expect(one.customer.id).toBe(a.id)
  await saveCustomer({ name: 'Twin', phone: '1' })
  await saveCustomer({ name: 'twin', phone: '2' })
  const many = await resolveCustomerByName('TWIN')
  expect(many.status).toBe('many')
  expect(many.customers).toHaveLength(2)
})

test('getClientNames returns distinct sorted names; clients.js exports only the two helpers', async () => {
  await saveCustomer({ name: 'Zed' })
  await saveCustomer({ name: 'Abe' })
  await saveCustomer({ name: 'Abe' })
  expect(await getClientNames()).toEqual(['Abe', 'Zed'])
  expect(Object.keys(clients).sort()).toEqual(['getClientNames', 'resolveCustomerByName'])
})

test('delete blocked by orders and by reports; farms converted to prospects', async () => {
  const withOrder = await saveCustomer({ name: 'Has Order' })
  await addOrder({ client: 'Has Order', orderDetails: 'x', customerId: withOrder.id })
  expect(await deleteCustomer(withOrder.id, 'delete')).toEqual({ ok: false, reason: 'has-orders' })

  const withReport = await saveCustomer({ name: 'Has Report' })
  await saveDailyReports([{ id: 'r1', date: '2026-11-01', client: 'Has Report', notes: '', customerId: withReport.id }])
  expect(await customerUsage(withReport.id)).toEqual({ orders: 0, reports: 1 })
  expect(await deleteCustomer(withReport.id, 'delete')).toEqual({ ok: false, reason: 'has-reports' })
  expect(await getCustomer(withReport.id)).toBeTruthy()

  const free = await saveCustomer({ name: 'Free Customer' })
  await saveFarm({ name: 'F1', customerId: free.id })
  await saveFarm({ name: 'F2', customerId: free.id, lat: 35, lng: -5 })
  expect(await deleteCustomer(free.id, 'prospect')).toEqual({ ok: true })
  expect(await getCustomer(free.id)).toBeUndefined()
  const farms = await listFarms()
  expect(farms).toHaveLength(2)
  for (const f of farms) expect(f).toMatchObject({ status: 'prospect', customerId: null, ownerName: 'Free Customer' })

  const gone = await saveCustomer({ name: 'Gone' })
  await saveFarm({ name: 'G1', customerId: gone.id })
  expect(await deleteCustomer(gone.id, 'delete')).toEqual({ ok: true })
  expect(await listFarmsByCustomer(gone.id)).toHaveLength(0)
  expect(await listFarms()).toHaveLength(2)
})

test('rename updates client string on linked orders and reports', async () => {
  const c = await saveCustomer({ name: 'Old Name', phone: '0600' })
  await addOrder({ client: 'Old Name', orderDetails: 'x', customerId: c.id })
  await addOrder({ client: 'Old Name', orderDetails: 'unlinked' })
  await saveDailyReports([
    { id: 'r1', date: '2026-11-01', client: 'Old Name', notes: '', customerId: c.id },
    { id: 'r2', date: '2026-11-01', client: 'Other', notes: '', customerId: 'someone-else' },
  ])
  const renamed = await renameCustomer(c.id, '  New Name ')
  expect(renamed).toMatchObject({ id: c.id, name: 'New Name', phone: '0600' })
  const orders = await getAllOrders()
  expect(orders.find((o) => o.orderDetails === 'x').client).toBe('New Name')
  expect(orders.find((o) => o.orderDetails === 'unlinked').client).toBe('Old Name')
  const reports = await loadDailyReports()
  expect(reports.find((r) => r.id === 'r1').client).toBe('New Name')
  expect(reports.find((r) => r.id === 'r2').client).toBe('Other')
  expect(await customerUsage(c.id)).toEqual({ orders: 1, reports: 1 })
})

test('ensureCustomerId: none creates, one reuses, many asks the picker', async () => {
  const { ensureCustomerId } = await import('./customerLink.js')
  const neverAsk = () => { throw new Error('should not ask') }
  const created = await ensureCustomerId('  Fresh  Name ', neverAsk)
  expect((await getCustomer(created)).name).toBe('Fresh  Name')
  expect(await ensureCustomerId('fresh name', neverAsk)).toBe(created)

  const second = await saveCustomer({ name: 'Fresh Name' })
  expect(await ensureCustomerId('Fresh Name', async (list) => list.find((c) => c.id === second.id))).toBe(second.id)
  const third = await ensureCustomerId('Fresh Name', async () => null)
  expect([created, second.id]).not.toContain(third)
  expect((await getCustomer(third)).name).toBe('Fresh Name')
  expect(await ensureCustomerId('Fresh Name', async () => undefined)).toBeNull()
})
