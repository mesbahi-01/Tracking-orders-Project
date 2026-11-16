import { describe, test, expect, beforeEach } from 'vitest'
import { openDB } from 'idb'
import { getAllOrders, addOrder, getDB } from '../db.js'
import {
  saveCustomer, findCustomersByName, saveFarm, listFarmsByCustomer, getFarm,
  setSetting, getSetting, listCustomers, deleteFarm, putRaw, clearStores, listFarms,
} from './store.js'

function deleteDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase('orders-db')
    req.onsuccess = () => resolve()
    req.onblocked = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

beforeEach(async () => {
  await deleteDb()
})

describe('territory store', () => {
  test('same-name customers both persist', async () => {
    await saveCustomer({ name: 'Mohamed Alaoui', phone: '0600000001' })
    await saveCustomer({ name: 'mohamed  alaoui', phone: '0600000002' })
    expect((await findCustomersByName('MOHAMED ALAOUI')).length).toBe(2)
  })

  test('farm without coords is missing; verify kept when coords present', async () => {
    const c = await saveCustomer({ name: 'Client Démo', region: 'Région Test' })
    const f1 = await saveFarm({ name: 'مزرعة الأمل', customerId: c.id, capacity: '40 000' })
    expect(f1).toMatchObject({ lat: null, lng: null, locationStatus: 'missing', capacity: 40000, status: 'customer', region: 'Région Test' })
    const f2 = await saveFarm({ name: 'مزرعة الخير 2', customerId: c.id, lat: 34.568115, lng: -5.567138, locationStatus: 'verify', locationSource: 'import' })
    expect(f2.locationStatus).toBe('verify')
    expect((await listFarmsByCustomer(c.id)).length).toBe(2)
  })

  test('validation', async () => {
    await expect(saveFarm({ name: 'x', status: 'customer' })).rejects.toMatchObject({ field: 'customerId' })
    await expect(saveFarm({ name: 'x', lat: 35, lng: null })).rejects.toMatchObject({ field: 'location' })
    await expect(saveFarm({ name: 'x', lat: 91, lng: 0 })).rejects.toMatchObject({ field: 'location' })
    await expect(saveFarm({ name: '  ' })).rejects.toMatchObject({ field: 'name' })
    await expect(saveCustomer({ name: ' ' })).rejects.toMatchObject({ field: 'name' })
    expect((await saveFarm({ name: 'p', ownerName: 'Someone' })).status).toBe('prospect')
  })

  test('update merges, keeps createdAt, and delete works', async () => {
    const f = await saveFarm({ name: 'A', lat: 35, lng: -5 })
    expect(f.locationStatus).toBe('ok')
    const u = await saveFarm({ id: f.id, notes: ' hi ' })
    expect(u).toMatchObject({ name: 'A', lat: 35, lng: -5, notes: 'hi', createdAt: f.createdAt })
    expect((await getFarm(f.id)).notes).toBe('hi')
    await deleteFarm(f.id)
    expect(await getFarm(f.id)).toBeUndefined()
  })

  test('customers sorted by nameKey; putRaw and clearStores', async () => {
    await saveCustomer({ name: 'Zed' })
    await saveCustomer({ name: 'Abe' })
    expect((await listCustomers()).map((c) => c.name)).toEqual(['Abe', 'Zed'])
    await putRaw('farms', { id: 'raw1', name: 'raw' })
    expect((await listFarms()).length).toBe(1)
    await clearStores(['farms', 'customers'])
    expect((await listFarms()).length).toBe(0)
    expect((await listCustomers()).length).toBe(0)
  })

  test('existing v2 orders survive the upgrade', async () => {
    const old = await openDB('orders-db', 2, {
      upgrade(db) {
        const s = db.createObjectStore('orders', { keyPath: 'id', autoIncrement: true })
        s.createIndex('client', 'client', { unique: false })
        s.createIndex('orderDetails', 'orderDetails', { unique: false })
        s.createIndex('desiredDate', 'desiredDate', { unique: false })
        s.createIndex('createdAt', 'createdAt', { unique: false })
      },
    })
    await old.add('orders', { client: 'Old Client', orderDetails: 'x', createdAt: new Date().toISOString() })
    old.close()
    expect((await getAllOrders())[0].client).toBe('Old Client')
    const o = await addOrder({ client: 'N', customerId: 'c1' })
    expect(o.customerId).toBe('c1')
  })

  test('v1 database with product index and items upgrades to v3', async () => {
    const old = await openDB('orders-db', 1, {
      upgrade(db) {
        const s = db.createObjectStore('orders', { keyPath: 'id', autoIncrement: true })
        s.createIndex('client', 'client', { unique: false })
        s.createIndex('product', 'product', { unique: false })
        s.createIndex('desiredDate', 'desiredDate', { unique: false })
        s.createIndex('createdAt', 'createdAt', { unique: false })
      },
    })
    await old.add('orders', { client: 'V1 Client', items: [{ product: 'Feed', quantity: 5, unit: 'kg' }], createdAt: new Date().toISOString() })
    old.close()
    const orders = await getAllOrders()
    expect(orders).toHaveLength(1)
    expect(orders[0]).toMatchObject({ client: 'V1 Client', orderDetails: 'Feed (5 kg)' })
    expect(orders[0].items).toBeUndefined()
  })

  test('status enum and locationSource rules', async () => {
    expect((await saveFarm({ name: 'c', status: 'competitor' })).status).toBe('competitor')
    await expect(saveFarm({ name: 'x', status: 'bogus' })).rejects.toMatchObject({ field: 'status' })
    await expect(saveFarm({ name: 'x', locationSource: 'wifi' })).rejects.toMatchObject({ field: 'locationSource' })
    const e = await saveFarm({ name: 'e', lat: 35, lng: -5, locationSource: '' })
    expect(e.locationSource).toBeNull()
    const g = await saveFarm({ name: 'g', lat: 35, lng: -5, locationSource: 'gps', locationAccuracy: 12 })
    expect(g).toMatchObject({ locationSource: 'gps', locationAccuracy: 12 })
    const cleared = await saveFarm({ id: g.id, lat: null, lng: null })
    expect(cleared).toMatchObject({ locationStatus: 'missing', locationSource: null, locationAccuracy: null })
  })

  test('concurrent first opens all see the v3 stores', async () => {
    const dbs = await Promise.all([getDB(), getDB(), getDB(), getDB()])
    for (const d of dbs) {
      for (const name of ['orders', 'customers', 'farms', 'settings']) expect(d.objectStoreNames.contains(name)).toBe(true)
    }
  })

  test('settings round-trip', async () => {
    await setSetting('lastBackupAt', 'X')
    expect(await getSetting('lastBackupAt')).toBe('X')
    expect(await getSetting('nope')).toBeUndefined()
  })
})
