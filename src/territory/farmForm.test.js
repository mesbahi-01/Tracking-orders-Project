import { describe, it, expect } from 'vitest'
import { findDuplicateFarms, formToFarm, customerOptionLabel, locationInputError, findSameNameFarm } from './farmForm'

const farms = [
  { id: 'a', name: 'A', lat: 35.4, lng: -6.0 },
  { id: 'b', name: 'B', lat: 35.4004, lng: -6.0 },
  { id: 'c', name: 'C', lat: 35.5, lng: -6.0 },
  { id: 'd', name: 'D', lat: null, lng: null },
]

describe('findDuplicateFarms', () => {
  it('finds farms within 100 m, nearest first, with metres', () => {
    const r = findDuplicateFarms({ lat: 35.4001, lng: -6.0 }, farms)
    expect(r.map((x) => x.farm.id)).toEqual(['a', 'b'])
    expect(r[0].distanceM).toBeLessThanOrEqual(r[1].distanceM)
  })
  it('excludes the farm being edited, far farms and farms without coords', () => {
    const r = findDuplicateFarms({ lat: 35.4, lng: -6.0 }, farms, { excludeId: 'a' })
    expect(r.map((x) => x.farm.id)).toEqual(['b'])
    expect(r.find((x) => x.farm.id === 'c' || x.farm.id === 'd')).toBeUndefined()
  })
  it('returns nothing without a point', () => {
    expect(findDuplicateFarms({ lat: null, lng: null }, farms)).toEqual([])
  })
})

describe('formToFarm', () => {
  const base = { name: 'F', status: 'customer', customerId: 'c1', ownerName: 'x', capacity: '100', region: '', address: '', notes: '' }
  it('converts comma decimals to numbers', () => {
    const f = formToFarm({ ...base, lat: '35,5', lng: '-6.1', locationSource: 'typed' })
    expect(f.lat).toBe(35.5)
    expect(f.lng).toBe(-6.1)
    expect(f.locationStatus).toBe('ok')
    expect(f.ownerName).toBe('')
  })
  it('never invents coordinates: empty gives both null', () => {
    for (const v of [{ lat: '', lng: '' }, { lat: ' ', lng: '' }]) {
      const f = formToFarm({ ...base, ...v, locationSource: 'typed' })
      expect(f.lat).toBeNull()
      expect(f.lng).toBeNull()
      expect(f.locationSource).toBeNull()
      expect(f.locationStatus).toBe('missing')
    }
  })
  it('maps verify checkbox and drops customer for non-customers', () => {
    const f = formToFarm({ ...base, status: 'prospect', ownerName: 'Ali', lat: '35', lng: '-6', verify: true, locationSource: 'map' })
    expect(f.locationStatus).toBe('verify')
    expect(f.customerId).toBeNull()
    expect(f.ownerName).toBe('Ali')
  })
})

describe('customerOptionLabel', () => {
  it('includes phone and region', () => {
    expect(customerOptionLabel({ name: 'N', phone: '06', region: 'R' })).toBe('N · 06 · R')
    expect(customerOptionLabel({ name: 'N', phone: '', region: '' })).toBe('N')
  })
})

describe('locationInputError', () => {
  it('is null for both empty or both valid', () => {
    expect(locationInputError('', '')).toBeNull()
    expect(locationInputError(null, undefined)).toBeNull()
    expect(locationInputError('35,5', '-6.1')).toBeNull()
  })
  it('flags partial input', () => {
    expect(locationInputError('35', '')).toBe('partial')
    expect(locationInputError('', '-6')).toBe('partial')
  })
  it('flags garbage', () => {
    expect(locationInputError('abc', '1')).toBe('invalid')
    expect(locationInputError('35', '1x')).toBe('invalid')
  })
  it('flags out-of-range', () => {
    expect(locationInputError('95', '1')).toBe('out-of-range')
    expect(locationInputError('10', '-181')).toBe('out-of-range')
  })
})

describe('findSameNameFarm (farm name unique per customer, case/space-insensitive)', () => {
  const farms = [
    { id: 'f1', name: 'Ain  Amal', status: 'customer', customerId: 'c1', ownerName: '' },
    { id: 'f2', name: 'Douar', status: 'prospect', customerId: null, ownerName: 'Ali Ben' },
    { id: 'f3', name: 'Lonely', status: 'prospect', customerId: null, ownerName: '' },
  ]
  it('finds another farm of the same customer with the same normalised name', () => {
    expect(findSameNameFarm({ name: ' ain amal ', status: 'customer', customerId: 'c1' }, farms)?.id).toBe('f1')
  })
  it('ignores the farm being edited and other customers', () => {
    expect(findSameNameFarm({ id: 'f1', name: 'Ain Amal', status: 'customer', customerId: 'c1' }, farms)).toBeNull()
    expect(findSameNameFarm({ name: 'Ain Amal', status: 'customer', customerId: 'c2' }, farms)).toBeNull()
  })
  it('uses the owner name for prospects and competitors', () => {
    expect(findSameNameFarm({ name: 'DOUAR', status: 'competitor', ownerName: ' ali  ben' }, farms)?.id).toBe('f2')
    expect(findSameNameFarm({ name: 'Douar', status: 'prospect', ownerName: 'Someone else' }, farms)).toBeNull()
    // a customer farm with the same name is a different owner
    expect(findSameNameFarm({ name: 'Douar', status: 'customer', customerId: 'c1' }, farms)).toBeNull()
  })
  it('does not compare farms without any owner', () => {
    expect(findSameNameFarm({ name: 'Lonely', status: 'prospect', ownerName: '' }, farms)).toBeNull()
    expect(findSameNameFarm({ name: 'Ain Amal', status: 'customer', customerId: '' }, farms)).toBeNull()
    expect(findSameNameFarm({ name: '', status: 'customer', customerId: 'c1' }, farms)).toBeNull()
  })
})
