import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'

const SW_SOURCE = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8')

// Runs public/sw.js in a sandbox with fake caches/fetch and returns its fetch handler.
function loadSw({ fetchImpl }) {
  const stores = new Map()
  const openCache = (name) => {
    if (!stores.has(name)) {
      const m = new Map()
      stores.set(name, {
        _m: m,
        match: async (req) => m.get(typeof req === 'string' ? req : req.url),
        put: async (req, res) => { m.set(typeof req === 'string' ? req : req.url, res) },
        keys: async () => [...m.keys()].map((url) => ({ url })),
        delete: async (req) => m.delete(req.url),
        addAll: async () => {},
      })
    }
    return stores.get(name)
  }
  const listeners = {}
  const ResponseStub = { error: () => ({ type: 'error', ok: false, status: 0 }) }
  const self = { addEventListener: (type, fn) => { listeners[type] = fn }, skipWaiting: () => {} }
  const ctx = {
    self,
    caches: {
      open: async (n) => openCache(n),
      match: async (req) => { for (const c of stores.values()) { const r = await c.match(req); if (r) return r } return undefined },
      keys: async () => [...stores.keys()],
      delete: async (n) => stores.delete(n),
    },
    fetch: fetchImpl,
    Response: ResponseStub,
    URL,
    console,
  }
  vm.runInNewContext(SW_SOURCE, ctx)
  async function request(url) {
    let p
    const req = { url, method: 'GET', mode: 'cors' }
    listeners.fetch({ request: req, respondWith: (x) => { p = x } })
    return p
  }
  return { request, tileCache: () => openCache('map-tiles-v2')._m }
}

const resp = (o) => ({ clone() { return this }, ...o })
const TILE = 'https://tile.openstreetmap.org/12/1/2.png'

describe('service worker tile cache', () => {
  test('caches a CORS (ok) tile response', async () => {
    const sw = loadSw({ fetchImpl: async () => resp({ ok: true, status: 200, type: 'cors' }) })
    await sw.request(TILE)
    expect(sw.tileCache().has(TILE)).toBe(true)
  })

  test('never caches an opaque tile response (quota padding)', async () => {
    const sw = loadSw({ fetchImpl: async () => resp({ ok: false, status: 0, type: 'opaque' }) })
    const res = await sw.request(TILE)
    expect(res.type).toBe('opaque')
    expect(sw.tileCache().size).toBe(0)
  })

  test('arcgis tiles are handled by the tile cache', async () => {
    const url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/2/1'
    const sw = loadSw({ fetchImpl: async () => resp({ ok: true, status: 200, type: 'cors' }) })
    await sw.request(url)
    expect(sw.tileCache().has(url)).toBe(true)
  })

  test('offline with an uncached tile resolves to Response.error() instead of rejecting', async () => {
    const sw = loadSw({ fetchImpl: async () => { throw new TypeError('Failed to fetch') } })
    const res = await sw.request(TILE)
    expect(res).toMatchObject({ type: 'error' })
  })
})
