import { openDB } from 'idb'

const DB_NAME = 'orders-db'
const STORE_NAME = 'orders'
const VERSION = 2

async function getDB() {
  return openDB(DB_NAME, VERSION, {
    async upgrade(db, oldVersion, newVersion, transaction) {
      let store;
      if (oldVersion < 1) {
        // creating db for first time
        store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        store.createIndex('client', 'client', { unique: false })
        store.createIndex('orderDetails', 'orderDetails', { unique: false })
        store.createIndex('desiredDate', 'desiredDate', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      } else {
        store = transaction.objectStore(STORE_NAME);
      }

      if (oldVersion < 2) {
        if (store.indexNames.contains('product')) {
          store.deleteIndex('product');
        }
        if (!store.indexNames.contains('orderDetails')) {
            store.createIndex('orderDetails', 'orderDetails', { unique: false });
        }

        // data migration
        let cursor = await store.openCursor();
        while (cursor) {
            const value = { ...cursor.value };
            if (value.items && Array.isArray(value.items)) {
                value.orderDetails = value.items.map(item => `${item.product} (${item.quantity} ${item.unit})`).join(', ');
                delete value.items;
                await cursor.update(value);
            }
            cursor = await cursor.continue();
        }
      }
    }
  })
}

export async function addOrder(order) {
  const db = await getDB()
  const toAdd = {
    client: order.client || '',
    desiredDate: order.desiredDate || new Date().toISOString().split('T')[0],
    orderDetails: order.orderDetails || '',
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
  return all.filter(o => {
    const clientMatch = (o.client || '').toLowerCase().includes(lower);
    const orderDetailsMatch = (o.orderDetails || '').toLowerCase().includes(lower);
    const itemsMatch = o.items && o.items.some(item => (item.product || '').toLowerCase().includes(lower));
    return clientMatch || orderDetailsMatch || itemsMatch;
  })
}

export async function getOrder(id) {
  const db = await getDB()
  return db.get(STORE_NAME, id)
}

export async function deleteOrder(id) {
  const db = await getDB()
  await db.delete(STORE_NAME, id)
}

export async function updateClientInOrders(oldName, newName) {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('client');
    let cursor = await index.openCursor(IDBKeyRange.only(oldName));
    while (cursor) {
        const value = { ...cursor.value };
        value.client = newName;
        cursor.update(value);
        cursor = await cursor.continue();
    }
    await tx.done;
}

export async function hasOrders(clientName) {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('client');
    const count = await index.count(IDBKeyRange.only(clientName));
    return count > 0;
}
