import { describe, it, expect } from 'vitest'
import { truncateLabel, barLengths, columnWidths } from './chartLayout.js'

describe('truncateLabel', () => {
  it('keeps short labels', () => expect(truncateLabel('abc', 5)).toBe('abc'))
  it('truncates with ellipsis', () => expect(truncateLabel('abcdefgh', 5)).toBe('abcd…'))
  it('handles Arabic and null', () => {
    expect(truncateLabel('مزرعة النور الكبير', 6)).toHaveLength(6)
    expect(truncateLabel(null, 5)).toBe('')
  })
})
describe('barLengths', () => {
  it('scales to the max', () => expect(barLengths([50, 100], 200)).toEqual([100, 200]))
  it('min length for tiny positives, 0 for zero', () => expect(barLengths([0, 1, 1000], 100)).toEqual([0, 2, 100]))
  it('all zero / bad track', () => {
    expect(barLengths([0, 0], 100)).toEqual([0, 0])
    expect(barLengths([5], 0)).toEqual([0])
    expect(barLengths([NaN, -3], 100)).toEqual([0, 0])
  })
})
describe('columnWidths', () => {
  it('track is never negative', () => expect(columnWidths(100).track).toBeGreaterThanOrEqual(0))
  it('sums within width', () => {
    const c = columnWidths(360)
    expect(c.labelCol + c.valueCol + c.track).toBeLessThanOrEqual(360)
  })
})
