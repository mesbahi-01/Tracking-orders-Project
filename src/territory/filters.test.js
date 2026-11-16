import { describe, it, expect } from 'vitest'
import { applyFarmFilters } from './filters.js'
import { allFarms as farms, customersById as byId } from './fixtures.js'

describe('applyFarmFilters', () => {
  it('matches normalised text', () => {
    expect(applyFarmFilters(farms, byId, { text: 'النـــور' }).length).toBe(1)
    expect(applyFarmFilters(farms, byId, { text: 'client' }).length).toBe(9)
    expect(applyFarmFilters(farms, byId, { text: 'voisin' }).length).toBe(1)
  })
  it('capMin excludes null capacity only when set', () => {
    expect(applyFarmFilters(farms, byId, { capMin: 32000 }).map(f => f.capacity).sort()).toEqual([32000, 32000, 40000, 40000, 42000])
    expect(applyFarmFilters(farms, byId, {}).length).toBe(10)
    expect(applyFarmFilters(farms, byId, { capMax: 15000 }).length).toBe(2)
  })
  it('filters by location status, status, customer, region', () => {
    expect(applyFarmFilters(farms, byId, { locationStatuses: ['verify'] }).length).toBe(3)
    expect(applyFarmFilters(farms, byId, { statuses: ['prospect'] }).length).toBe(1)
    expect(applyFarmFilters(farms, byId, { statuses: [] }).length).toBe(10)
    expect(applyFarmFilters(farms, byId, { customerId: 'c1' }).length).toBe(9)
    expect(applyFarmFilters(farms, byId, { region: 'Région Test' }).length).toBe(9)
  })
})
