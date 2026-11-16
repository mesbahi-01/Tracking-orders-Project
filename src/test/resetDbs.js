import { saveDailyReports } from '../lib/dailyReportsStorage.js'

function deleteDb(name) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name)
    req.onsuccess = () => resolve()
    req.onblocked = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// orders-db connections close on versionchange, so that database can be deleted.
// tracking-orders-db connections are never closed, so its store is cleared instead.
export async function resetAll() {
  await deleteDb('orders-db')
  await saveDailyReports([])
  localStorage.clear()
}
