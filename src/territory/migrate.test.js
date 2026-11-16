import { test, expect, beforeEach } from 'vitest'
import { addOrder, getAllOrders, getDB } from '../db.js'
import { loadDailyReports, saveDailyReports } from '../lib/dailyReportsStorage.js'
import { listCustomers, saveCustomer, getSetting, putRaw } from './store.js'
import { runMigrationV3 } from './migrate.js'
import { resetAll } from '../test/resetDbs.js'

beforeEach(resetAll)

test('migrates clients from all usernames, orders and reports, idempotently', async () => {
  localStorage.setItem('clients_demo', JSON.stringify(['Client Démo', 'Ferme Sahel']))
  localStorage.setItem('clients_other', JSON.stringify(['client  démo', 'Only Other']))
  await addOrder({ client: 'Order Only', orderDetails: 'x' })
  await saveDailyReports([{ id: 'r1', date: '2026-11-01', client: 'Report Only', notes: '' }])
  expect((await runMigrationV3()).createdCustomers).toBe(5)
  expect((await runMigrationV3()).createdCustomers).toBe(0)
  expect((await listCustomers()).length).toBe(5)
  const [order] = await getAllOrders(); expect(order.customerId).toBeTruthy(); expect(order.client).toBe('Order Only')
  const [rep] = await loadDailyReports(); expect(rep.customerId).toBeTruthy()
  expect(localStorage.getItem('clients_demo')).not.toBeNull()
  expect(await getSetting('migration.v3')).toBe(true)
})

test('first-seen spelling wins; same normalised name links to one customer; existing customerId kept', async () => {
  localStorage.setItem('clients_a', JSON.stringify(['Client Démo', '', '   ', 42]))
  localStorage.setItem('clients_bad', 'not json')
  localStorage.setItem('unrelated', JSON.stringify(['Nope']))
  await addOrder({ client: 'CLIENT démo', orderDetails: 'x' })
  await addOrder({ client: 'Kept', orderDetails: 'y', customerId: 'pre-existing' })
  await addOrder({ client: '', orderDetails: 'z' })
  await saveDailyReports([
    { id: 'r1', date: '2026-11-01', client: 'client  démo', notes: '', voiceNotes: [{ url: 'data:x', name: 'n' }] },
    { id: 'r2', date: '2026-11-02', notes: '' },
  ])
  await runMigrationV3()
  const customers = await listCustomers()
  expect(customers.map((c) => c.name).sort()).toEqual(['Client Démo', 'Kept'])
  const demo = customers.find((c) => c.name === 'Client Démo')
  const orders = await getAllOrders()
  expect(orders).toHaveLength(3)
  expect(orders.find((o) => o.client === 'CLIENT démo').customerId).toBe(demo.id)
  expect(orders.find((o) => o.client === 'Kept').customerId).toBe('pre-existing')
  expect(orders.find((o) => o.client === '').customerId ?? null).toBeNull()
  const reports = await loadDailyReports()
  expect(reports).toHaveLength(2)
  const r1 = reports.find((r) => r.id === 'r1')
  expect(r1).toMatchObject({ customerId: demo.id, client: 'client  démo', voiceNotes: [{ url: 'data:x', name: 'n' }] })
  expect(reports.find((r) => r.id === 'r2').customerId).toBeUndefined()
})

test('no-op when already migrated', async () => {
  await saveCustomer({ name: 'Existing' })
  localStorage.setItem('clients_x', JSON.stringify(['Someone']))
  await runMigrationV3()
  localStorage.setItem('clients_y', JSON.stringify(['Later']))
  expect(await runMigrationV3()).toEqual({ createdCustomers: 0 })
  expect((await listCustomers()).map((c) => c.name)).toEqual(['Existing', 'Someone'])
})

test('reuses a customer that already exists with the same name', async () => {
  const pre = await saveCustomer({ name: 'Ferme Sahel' })
  await addOrder({ client: 'ferme sahel', orderDetails: 'x' })
  expect((await runMigrationV3()).createdCustomers).toBe(0)
  expect((await getAllOrders())[0].customerId).toBe(pre.id)
})

test('concurrent calls (React StrictMode double effect) do not duplicate customers', async () => {
  localStorage.setItem('clients_a', JSON.stringify(['One', 'Two']))
  const [a, b] = await Promise.all([runMigrationV3(), runMigrationV3()])
  expect(a.createdCustomers).toBe(2)
  expect(b.createdCustomers).toBe(2) // shared run, same result
  expect((await listCustomers()).length).toBe(2)
})

test('legacy order without createdAt is collected and linked', async () => {
  await putRaw('orders', { client: 'No Date Client', orderDetails: 'legacy' })
  expect((await runMigrationV3()).createdCustomers).toBe(1)
  const db = await getDB()
  const [order] = await db.getAll('orders')
  const [c] = await listCustomers()
  expect(c.name).toBe('No Date Client')
  expect(order).toMatchObject({ client: 'No Date Client', orderDetails: 'legacy', customerId: c.id })
})
