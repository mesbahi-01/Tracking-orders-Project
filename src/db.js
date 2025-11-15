import { openDB } from 'idb'

const DB_NAME = 'orders-db'
const STORE_NAME = 'orders'
const VERSION = 1

async function getDB() {
  return openDB(DB_NAME, VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        store.createIndex('client', 'client', { unique: false })
        store.createIndex('product', 'product', { unique: false })
        store.createIndex('desiredDate', 'desiredDate', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
  })
}

export async function addOrder(order) {
  const db = await getDB()
  const toAdd = {
    client: order.client || '',
    desiredDate: order.desiredDate || new Date().toISOString().split('T')[0],
    items: order.items || [], // array of { product, quantity, unit }
    delivered: order.delivered || false,
    cancelled: order.cancelled || false,
    createdAt: new Date().toISOString()
  }
  const id = await db.add(STORE_NAME, toAdd)
  return { id, ...toAdd }
}

export async function updateOrder(id, partial) {
  const db = await getDB()
  const existing = await db.get(STORE_NAME, id)
  if (!existing) throw new Error('Order not found')
  const updated = { ...existing, ...partial }
  await db.put(STORE_NAME, updated)
  return updated
}

export async function getAllOrders() {
  const db = await getDB()
  return db.getAllFromIndex(STORE_NAME, 'createdAt')
}

export async function getOrdersSortedDesc() {
  const db = await getDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const items = await store.getAll()
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  return items
}

export async function toggleDelivered(id) {
  const db = await getDB()
  const item = await db.get(STORE_NAME, id)
  if (!item) throw new Error('Order not found')
  item.delivered = !item.delivered
  await db.put(STORE_NAME, item)
  return item
}

export async function cancelOrder(id) {
  const db = await getDB()
  const item = await db.get(STORE_NAME, id)
  if (!item) throw new Error('Order not found')
  item.cancelled = !item.cancelled
  await db.put(STORE_NAME, item)
  return item
}

export async function searchOrders(query) {
  const lower = (query || '').toLowerCase()
  if (!lower) return getOrdersSortedDesc()
  const all = await getOrdersSortedDesc()
  return all.filter(o =>
    (o.client || '').toLowerCase().includes(lower) ||
    (o.product || '').toLowerCase().includes(lower)
  )
}

export async function getOrder(id) {
  const db = await getDB()
  return db.get(STORE_NAME, id)
}

export async function deleteOrder(id) {
  const db = await getDB()
  await db.delete(STORE_NAME, id)
}
