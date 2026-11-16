import { describe, it, expect } from 'vitest'
import { normalizeName, parseNumberLoose, parseCapacity } from './normalize.js'

describe('normalizeName', () => {
  it('collapses whitespace', () => {
    expect(normalizeName('  مزرعة   الزيتون ')).toBe(normalizeName('مزرعة الزيتون'))
  })
  it('folds alef variants', () => {
    expect(normalizeName('أحمد')).toBe(normalizeName('احمد'))
    expect(normalizeName('إ آ ٱ ى')).toBe('ا ا ا ي')
  })
  it('removes tatweel and diacritics', () => {
    expect(normalizeName('مزرعة الـــنور')).toBe(normalizeName('مزرعة النور'))
    expect(normalizeName('مُحَمَّد')).toBe('محمد')
  })
  it('converts Arabic-Indic digits', () => {
    expect(normalizeName('مزرعة الخير ١')).toBe('مزرعة الخير 1')
  })
  it('lowercases latin', () => {
    expect(normalizeName('Client  DÉMO')).toBe('client démo')
  })
  it('handles null/undefined', () => {
    expect(normalizeName(null)).toBe('')
    expect(normalizeName(undefined)).toBe('')
  })
})

describe('parseNumberLoose', () => {
  it('parses', () => {
    expect(parseNumberLoose('34,518505')).toBe(34.518505)
    expect(parseNumberLoose(' -5.622656 ')).toBe(-5.622656)
    expect(parseNumberLoose(4)).toBe(4)
    expect(parseNumberLoose('abc')).toBeNull()
    expect(parseNumberLoose(null)).toBeNull()
  })
})

describe('parseCapacity', () => {
  it('parses variants', () => {
    for (const v of ['40000', '40 000', '40.000', '40,000', '40000 poussins', 40000, '40 000'])
      expect(parseCapacity(v)).toBe(40000)
  })
  it('rejects invalid', () => {
    expect(parseCapacity('')).toBeNull()
    expect(parseCapacity('-5')).toBeNull()
    expect(parseCapacity(null)).toBeNull()
  })
})
