import { describe, it, expect } from 'vitest'
import { readNearby, buildNearbyParams, nextRadius, searchFarms } from './nearbyParams'

describe('readNearby', () => {
  it('reads farm, me and radius', () => {
    expect(readNearby(new URLSearchParams('farm=f1&r=20'), 5)).toEqual({ farmId: 'f1', me: false, radius: 20 })
    expect(readNearby(new URLSearchParams('me=1'), null)).toEqual({ farmId: null, me: true, radius: 10 })
  })
  it('falls back to saved then 10 when r is invalid', () => {
    expect(readNearby(new URLSearchParams('r=7'), 30).radius).toBe(30)
    expect(readNearby(new URLSearchParams('r=abc'), 99).radius).toBe(10)
  })
  it('farm wins over me', () => {
    expect(readNearby(new URLSearchParams('farm=f1&me=1'), null)).toMatchObject({ farmId: 'f1', me: false })
  })
})

describe('buildNearbyParams', () => {
  it('serialises', () => {
    expect(buildNearbyParams({ farmId: 'f1', me: false, radius: 20 }).toString()).toBe('farm=f1&r=20')
    expect(buildNearbyParams({ farmId: null, me: true, radius: 5 }).toString()).toBe('me=1&r=5')
    expect(buildNearbyParams({ farmId: null, me: false, radius: 5 }).toString()).toBe('r=5')
  })
})

describe('nextRadius', () => {
  it('returns next or null at max', () => {
    expect(nextRadius(5)).toBe(10)
    expect(nextRadius(30)).toBe(50)
    expect(nextRadius(50)).toBeNull()
  })
})

describe('searchFarms', () => {
  const farms = [
    { id: 'a', name: 'Dar Sid', customerId: 'c1' },
    { id: 'b', name: 'Hawmar', ownerName: 'Ali' },
    { id: 'c', name: 'Other', customerId: 'c2' },
  ]
  const byId = { c1: { name: 'Ahmed' }, c2: { name: 'Sid Group' } }
  it('matches name or customer/owner, normalised', () => {
    expect(searchFarms(farms, byId, '  SID ').map((f) => f.id)).toEqual(['a', 'c'])
    expect(searchFarms(farms, byId, 'ali').map((f) => f.id)).toEqual(['b'])
  })
  it('empty query gives nothing; limit applies', () => {
    expect(searchFarms(farms, byId, '')).toEqual([])
    expect(searchFarms(farms, byId, 's', 1)).toHaveLength(1)
  })
})
