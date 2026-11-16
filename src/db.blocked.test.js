import { test, expect, beforeEach } from 'vitest'
import { resetAll } from './test/resetDbs.js'
import { getDB, isDbBlocked, onDbBlockedChange } from './db.js'

beforeEach(resetAll)

// An "old tab": a connection at an older version that ignores versionchange.
function openOld(version = 2) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('orders-db', version)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('orders')) db.createObjectStore('orders', { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

test('an upgrade blocked by an old connection raises the blocked flag, cleared once it proceeds', async () => {
  const old = await openOld()
  const seen = []
  const off = onDbBlockedChange((b) => seen.push(b))
  const pending = getDB()
  await new Promise((r) => setTimeout(r, 50))
  expect(isDbBlocked()).toBe(true)
  expect(seen).toContain(true)

  old.close()
  const db = await pending
  expect(db.version).toBe(3)
  expect(isDbBlocked()).toBe(false)
  expect(seen[seen.length - 1]).toBe(false)
  db.close()
  off()
})
