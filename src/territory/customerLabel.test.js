import { describe, test, expect } from 'vitest'
import { customerOptionLabel, customerLabel, customerLabeler } from './customerLabel.js'

const a1 = { id: 'a1', name: 'Mohamed Alaoui', nameKey: 'mohamed alaoui', phone: '0611', region: 'Asilah' }
const a2 = { id: 'a2', name: 'mohamed  ALAOUI', nameKey: 'mohamed alaoui', phone: '0622', region: '' }
const b = { id: 'b', name: 'Client', nameKey: 'client', phone: '0633', region: 'Région Test' }
const all = [a1, a2, b]

describe('customer labels', () => {
  test('option label always shows phone and region', () => {
    expect(customerOptionLabel(a1)).toBe('Mohamed Alaoui · 0611 · Asilah')
    expect(customerOptionLabel(b)).toBe('Client · 0633 · Région Test')
  })
  test('plain name when unique, name · phone · region when another customer has the same normalised name', () => {
    expect(customerLabel(b, all)).toBe('Client')
    expect(customerLabel(a1, all)).toBe('Mohamed Alaoui · 0611 · Asilah')
    expect(customerLabel(a2, all)).toBe('mohamed  ALAOUI · 0622')
  })
  test('customerLabeler precomputes counts and gives the same answers', () => {
    const label = customerLabeler(all)
    expect(all.map(label)).toEqual(all.map((c) => customerLabel(c, all)))
    expect(label(null)).toBe('')
  })
})
