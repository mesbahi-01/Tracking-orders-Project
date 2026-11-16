import { describe, it, expect } from 'vitest'
import { parseCoordinates, haversineKm, isInMorocco, findNearby, mapsLinks, RADII_KM, circleBounds, hasCoords } from './geo.js'

describe('parseCoordinates', () => {
  it('parses decimals', () => {
    expect(parseCoordinates('34.518505, -5.622656')).toEqual({ lat: 34.518505, lng: -5.622656 })
    expect(parseCoordinates('34,518505 ; -5,622656')).toEqual({ lat: 34.518505, lng: -5.622656 })
  })
  it('parses DMS', () => {
    const dms = parseCoordinates(`34°27'12.9"N 5°34'12.9"W`)
    expect(dms.lat).toBeCloseTo(34.453583, 5)
    expect(dms.lng).toBeCloseTo(-5.57025, 5)
  })
  it('parses Google Maps URLs', () => {
    expect(parseCoordinates('https://www.google.com/maps/place/34.498872,-5.602563/data=!4m6')).toEqual({ lat: 34.498872, lng: -5.602563 })
    expect(parseCoordinates('https://www.google.com/maps/place/Lieu+Test/data=!4m6!3m5!1s0x0!7e2!8m2!3d34.4912945!4d-5.6104224')).toEqual({ lat: 34.4912945, lng: -5.6104224 })
    expect(parseCoordinates('https://www.google.com/maps/@34.57,-5.57,15z')).toEqual({ lat: 34.57, lng: -5.57 })
    expect(parseCoordinates('https://maps.google.com/?q=35.1,-5.2')).toEqual({ lat: 35.1, lng: -5.2 })
  })
  it('returns errors', () => {
    expect(parseCoordinates('https://maps.app.goo.gl/DEMOLINK0000000001')).toEqual({ error: 'short-link' })
    expect(parseCoordinates('')).toEqual({ error: 'empty' })
    expect(parseCoordinates('95, 10')).toEqual({ error: 'out-of-range' })
    expect(parseCoordinates('hello')).toEqual({ error: 'unrecognized' })
  })
})

describe('distance', () => {
  it('haversine known distance', () => {
    expect(haversineKm({ lat: 34.518505, lng: -5.622656 }, { lat: 34.498872, lng: -5.602563 })).toBeCloseTo(2.856, 2)
  })
  it('isInMorocco', () => {
    expect(isInMorocco({ lat: 34.52, lng: -5.62 })).toBe(true)
    expect(isInMorocco({ lat: -5.62, lng: 34.52 })).toBe(false)
  })
})

describe('findNearby', () => {
  const farms = [
    { id: 'o', lat: 34.518505, lng: -5.622656, status: 'customer' },
    { id: 'a', lat: 34.498872, lng: -5.602563, status: 'customer' },
    { id: 'b', lat: 34.590505, lng: -5.535438, status: 'prospect' },
    { id: 'm', lat: null, lng: null, status: 'customer' },
  ]
  const origin = { lat: 34.518505, lng: -5.622656 }
  it('excludes origin, counts missing, sorts', () => {
    const r = findNearby(origin, farms, 5, { excludeId: 'o' })
    expect(r.results.map(x => x.farm.id)).toEqual(['a'])
    expect(r.missingCount).toBe(1)
    expect(findNearby(origin, farms, 20, { excludeId: 'o' }).results.map(x => x.farm.id)).toEqual(['a', 'b'])
  })
  it('filters by status', () => {
    expect(findNearby(origin, farms, 20, { excludeId: 'o', statuses: ['prospect'] }).results.map(x => x.farm.id)).toEqual(['b'])
  })
  it('radius is inclusive', () => {
    const d = haversineKm(origin, farms[1])
    expect(findNearby(origin, farms, d, { excludeId: 'o' }).results).toHaveLength(1)
  })
})

describe('misc', () => {
  it('mapsLinks and RADII_KM', () => {
    expect(mapsLinks({ lat: 1, lng: 2 })).toEqual({
      view: 'https://www.google.com/maps/search/?api=1&query=1,2',
      directions: 'https://www.google.com/maps/dir/?api=1&destination=1,2',
    })
    expect(RADII_KM).toEqual([5, 10, 20, 30, 50])
  })
})

describe('circleBounds', () => {
  it('returns a south-west / north-east box that contains the whole circle', () => {
    const c = { lat: 34.518505, lng: -5.622656 }
    const [[s, w], [n, e]] = circleBounds(c, 10)
    expect(s).toBeLessThan(c.lat)
    expect(n).toBeGreaterThan(c.lat)
    expect(w).toBeLessThan(c.lng)
    expect(e).toBeGreaterThan(c.lng)
    // edges are at (or just beyond) the radius
    expect(haversineKm(c, { lat: n, lng: c.lng })).toBeGreaterThanOrEqual(10 - 1e-6)
    expect(haversineKm(c, { lat: s, lng: c.lng })).toBeGreaterThanOrEqual(10 - 1e-6)
    expect(haversineKm(c, { lat: c.lat, lng: e })).toBeGreaterThanOrEqual(10 - 1e-6)
    expect(haversineKm(c, { lat: c.lat, lng: w })).toBeGreaterThanOrEqual(10 - 1e-6)
    expect(haversineKm(c, { lat: n, lng: c.lng })).toBeLessThan(10.1)
  })
})

describe('parseCoordinates rejects ambiguous comma pairs (never invent coordinates)', () => {
  it('rejects a comma that could be a decimal separator', () => {
    expect(parseCoordinates('35,4')).toEqual({ error: 'unrecognized' })
    expect(parseCoordinates('35,41')).toEqual({ error: 'unrecognized' })
    expect(parseCoordinates('34,5185')).toEqual({ error: 'unrecognized' })
    expect(parseCoordinates('35.4,6')).toEqual({ error: 'unrecognized' })
  })
  it('accepts unambiguous pairs', () => {
    expect(parseCoordinates('34.5185,-5.62')).toEqual({ lat: 34.5185, lng: -5.62 })
    expect(parseCoordinates('34.5185, -5.62')).toEqual({ lat: 34.5185, lng: -5.62 })
    expect(parseCoordinates('35, -6')).toEqual({ lat: 35, lng: -6 })
    expect(parseCoordinates('34,5185 -5,62')).toEqual({ lat: 34.5185, lng: -5.62 })
    expect(parseCoordinates('34,5185;-5,62')).toEqual({ lat: 34.5185, lng: -5.62 })
  })
})

describe('hasCoords', () => {
  it('accepts only finite numbers for both lat and lng', () => {
    expect(hasCoords({ lat: 0, lng: 0 })).toBe(true)
    expect(hasCoords({ lat: 35.4, lng: -6 })).toBe(true)
    expect(hasCoords({ lat: NaN, lng: -6 })).toBe(false)
    expect(hasCoords({ lat: 35, lng: Infinity })).toBe(false)
    expect(hasCoords({ lat: '35', lng: '-6' })).toBe(false)
    expect(hasCoords({ lat: null, lng: null })).toBe(false)
    expect(hasCoords(null)).toBe(false)
  })
})
