import { describe, it, expect } from 'vitest'
import { customerTotals, totalsByCustomer } from './customerStats.js'

const farms = [
  { id: 1, customerId: 'a', status: 'customer', capacity: 1000 },
  { id: 2, customerId: 'a', status: 'customer', capacity: null },
  { id: 3, customerId: 'a', status: 'prospect', capacity: 500 },
  { id: 4, customerId: 'b', status: 'customer', capacity: 200 },
]

describe('customerTotals', () => {
  it('sums known capacity and counts unknown', () => {
    expect(customerTotals(farms, 'a')).toEqual({ farmCount: 3, capacity: 1000, unknown: 1, known: 1 })
  })
  it('handles customers without farms', () => {
    expect(customerTotals(farms, 'z')).toEqual({ farmCount: 0, capacity: 0, unknown: 0, known: 0 })
  })
  it('reports known=0 when every capacity is unknown', () => {
    expect(customerTotals([{ customerId: 'q', status: 'customer', capacity: null }], 'q').known).toBe(0)
  })
  it('totalsByCustomer indexes by id', () => {
    expect(totalsByCustomer(farms).b.capacity).toBe(200)
  })
})
