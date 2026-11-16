import { describe, it, expect } from 'vitest'
import { filtersFromSearch, filtersToSearch } from './filterParams.js'

describe('filterParams', () => {
  it('parses an empty query to empty filters', () => {
    expect(filtersFromSearch(new URLSearchParams(''))).toEqual({
      text: '', customerId: '', statuses: [], region: '', capMin: null, capMax: null, locationStatuses: [],
    })
  })
  it('parses all params', () => {
    const f = filtersFromSearch(new URLSearchParams('q=abc&c=c1&s=customer,prospect&r=Asilah&min=100&max=900&ls=missing,verify'))
    expect(f).toEqual({
      text: 'abc', customerId: 'c1', statuses: ['customer', 'prospect'], region: 'Asilah',
      capMin: 100, capMax: 900, locationStatuses: ['missing', 'verify'],
    })
  })
  it('ignores non-numeric min/max and unknown enum values', () => {
    const f = filtersFromSearch(new URLSearchParams('min=x&max=&s=customer,bogus&ls=nope'))
    expect(f.capMin).toBeNull()
    expect(f.capMax).toBeNull()
    expect(f.statuses).toEqual(['customer'])
    expect(f.locationStatuses).toEqual([])
  })
  it('omits empty values when serialising', () => {
    expect(filtersToSearch({ text: '', statuses: [], capMin: null }).toString()).toBe('')
    expect(filtersToSearch({ text: 'a b', statuses: ['customer', 'prospect'], capMin: 0 }).toString())
      .toBe('q=a+b&s=customer%2Cprospect&min=0')
  })
  it('round-trips', () => {
    const f = {
      text: 'x', customerId: 'c9', statuses: ['competitor'], region: 'Larache', capMin: 5, capMax: 50, locationStatuses: ['ok'],
    }
    expect(filtersFromSearch(filtersToSearch(f))).toEqual(f)
  })
})
