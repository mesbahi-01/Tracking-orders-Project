import { describe, it, expect } from 'vitest'
import { computeStats, prospectsNearCustomers } from './stats.js'
import { allFarms as farms, customers, customer } from './fixtures.js'

describe('computeStats', () => {
  const s = computeStats(customers, farms)
  it('totals', () => {
    expect(s.customerCount).toBe(1)
    expect(s.farmCount).toBe(10)
    expect(s.totalCapacity).toBe(233000)
    expect(s.knownCapacityCount).toBe(8)
    expect(s.unknownCapacityCount).toBe(1)
    expect(s.avgCapacity).toBe(29125)
    expect(s.farmsByStatus).toEqual({ customer: 9, prospect: 1, competitor: 0 })
    expect(s.needsLocation).toBe(4)
  })
  it('lists', () => {
    expect(s.topFarms[0].name).toBe('مزرعة النور')
    expect(s.topFarms.length).toBe(8)
    expect(s.topCustomers[0]).toMatchObject({ farms: 9, capacity: 233000, unknown: 1 })
    expect(s.topCustomers[0].customer).toBe(customer)
    // T12: a region whose capacities are all unknown has capacity null (shown as —), not 0
    expect(s.byRegion).toEqual([{ region: 'Région Test', farms: 9, capacity: 233000 }, { region: '', farms: 1, capacity: null }])
  })
  it('avg null when nothing known', () => {
    expect(computeStats([], []).avgCapacity).toBeNull()
  })
})

describe('prospectsNearCustomers', () => {
  it('finds nearest customer farm', () => {
    const r = prospectsNearCustomers(farms)
    expect(r.length).toBe(1)
    expect(r[0].nearest.name).toBe('مزرعة الأمل')
    expect(r[0].distanceKm).toBeLessThan(1)
    expect(prospectsNearCustomers(farms, 0.0001)).toEqual([])
  })
})

describe('byRegion capacity (T12)', () => {
  it('is null when no farm of the region has a known customer capacity, 0 only when known to be 0', () => {
    const s = computeStats([], [
      { id: 'a', status: 'customer', region: 'R1', capacity: null },
      { id: 'b', status: 'prospect', region: 'R1', capacity: 500 },
      { id: 'c', status: 'customer', region: 'R2', capacity: 0 },
      { id: 'd', status: 'customer', region: 'R3', capacity: 100 },
    ])
    expect(s.byRegion).toEqual([
      { region: 'R3', farms: 1, capacity: 100 },
      { region: 'R2', farms: 1, capacity: 0 },
      { region: 'R1', farms: 2, capacity: null },
    ])
  })
})
