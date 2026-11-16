import { test, expect, vi, afterEach } from 'vitest'
import { TILE_LAYERS } from './tiles.js'
import { requestPersistentStorage, _resetPersistForTests } from './persist.js'

test('all tile layers load with CORS so the service worker never stores opaque tiles', () => {
  for (const layer of Object.values(TILE_LAYERS)) {
    expect(layer.crossOrigin).toBe('anonymous')
  }
})

test('OSM streets use the single tile.openstreetmap.org host (no {s} subdomain)', () => {
  expect(TILE_LAYERS.streets.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png')
})

afterEach(() => { vi.unstubAllGlobals(); _resetPersistForTests() })

test('requestPersistentStorage asks once and ignores failures', async () => {
  const persist = vi.fn().mockRejectedValue(new Error('nope'))
  vi.stubGlobal('navigator', { storage: { persist, persisted: vi.fn().mockResolvedValue(false) } })
  await expect(requestPersistentStorage()).resolves.toBe(false)
  await requestPersistentStorage()
  expect(persist).toHaveBeenCalledTimes(1)
})

test('requestPersistentStorage is a no-op without the Storage API', async () => {
  vi.stubGlobal('navigator', {})
  await expect(requestPersistentStorage()).resolves.toBe(false)
})

test('requestPersistentStorage skips the request when already persisted', async () => {
  const persist = vi.fn().mockResolvedValue(true)
  vi.stubGlobal('navigator', { storage: { persist, persisted: vi.fn().mockResolvedValue(true) } })
  await expect(requestPersistentStorage()).resolves.toBe(true)
  expect(persist).not.toHaveBeenCalled()
})
