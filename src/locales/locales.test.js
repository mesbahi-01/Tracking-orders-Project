import { describe, it, expect } from 'vitest'
import en from './en.json'
import fr from './fr.json'

function flatten(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  )
}

describe('locales', () => {
  it('fr has exactly the same keys as en', () => {
    expect(flatten(fr).sort()).toEqual(flatten(en).sort())
  })
})
