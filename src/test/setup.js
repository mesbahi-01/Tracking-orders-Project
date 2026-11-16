import 'fake-indexeddb/auto'

// Node >= 22 defines its own global localStorage (undefined without
// --localstorage-file), which hides jsdom's. Install an in-memory Storage.
if (typeof globalThis.localStorage?.getItem !== 'function') {
  class MemoryStorage {
    #m = new Map()
    get length() { return this.#m.size }
    key(i) { return [...this.#m.keys()][i] ?? null }
    getItem(k) { return this.#m.has(String(k)) ? this.#m.get(String(k)) : null }
    setItem(k, v) { this.#m.set(String(k), String(v)) }
    removeItem(k) { this.#m.delete(String(k)) }
    clear() { this.#m.clear() }
  }
  const storage = new MemoryStorage()
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true })
  if (typeof window !== 'undefined' && window !== globalThis) {
    Object.defineProperty(window, 'localStorage', { value: storage, configurable: true, writable: true })
  }
}
