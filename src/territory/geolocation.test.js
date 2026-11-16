import { describe, it, expect, afterEach, vi } from 'vitest'
import { getCurrentPosition } from './geolocation.js'

const stub = (impl) => Object.defineProperty(navigator, 'geolocation', { value: impl, configurable: true })

describe('getCurrentPosition', () => {
  afterEach(() => { delete navigator.geolocation })

  it('resolves position', async () => {
    const getter = vi.fn((ok) => ok({ coords: { latitude: 1, longitude: 2, accuracy: 3 } }))
    stub({ getCurrentPosition: getter })
    expect(await getCurrentPosition()).toEqual({ lat: 1, lng: 2, accuracy: 3 })
    expect(getter.mock.calls[0][2]).toMatchObject({ enableHighAccuracy: true, timeout: 15000 })
  })
  it('maps error codes', async () => {
    for (const [code, name] of [[1, 'denied'], [2, 'unavailable'], [3, 'timeout']]) {
      stub({ getCurrentPosition: (_ok, err) => err({ code }) })
      expect(await getCurrentPosition()).toEqual({ error: name })
    }
  })
  it('unsupported', async () => {
    stub(undefined)
    expect(await getCurrentPosition()).toEqual({ error: 'unsupported' })
  })
  it('never rejects when getter throws', async () => {
    stub({ getCurrentPosition: () => { throw new Error('x') } })
    expect(await getCurrentPosition()).toEqual({ error: 'unavailable' })
  })
})
