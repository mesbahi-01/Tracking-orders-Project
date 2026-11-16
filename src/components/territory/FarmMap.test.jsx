import { test, expect, beforeEach } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import L from 'leaflet'
import '../../i18n.js'
import { resetAll } from '../../test/resetDbs.js'
import FarmMap from './FarmMap.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
beforeEach(resetAll)
// jsdom lacks SVGSVGElement.createSVGRect, so Leaflet detects no vector renderer.
L.Browser.svg = true

const wait = (ms = 50) => new Promise((r) => setTimeout(r, ms))

const origin = { lat: 34.518505, lng: -5.622656 }
const farms = [
  { id: 'a', name: 'A', status: 'customer', lat: 34.498872, lng: -5.602563 },
  { id: 'b', name: 'B', status: 'prospect', lat: NaN, lng: -6.0 },
]

// Regression: L.circle(...).getBounds() on an unattached layer threw
// "Cannot read properties of undefined (reading 'layerPointToLatLng')".
test('FarmMap with a circle and an origin renders without throwing', async () => {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  const errors = []
  const onError = (e) => { errors.push(e.error || e.message); e.preventDefault() }
  window.addEventListener('error', onError)
  try {
    await act(async () => {
      root.render(<FarmMap farms={farms} circle={{ center: origin, radiusKm: 10 }} origin={origin} fitTo="circle" height={300} />)
      await wait()
    })
    expect(errors).toEqual([])
    expect(el.querySelector('.farm-map-canvas')).not.toBeNull()
  } finally {
    window.removeEventListener('error', onError)
    await act(async () => root.unmount())
  }
})

test('NearbyPage with an origin farm selected renders results and the map', async () => {
  const { MemoryRouter, Routes, Route } = await import('react-router-dom')
  const { saveFarm } = await import('../../territory/store.js')
  const { default: NearbyPage } = await import('../../pages/NearbyPage.jsx')
  const { default: i18n } = await import('i18next')
  await i18n.changeLanguage('en')
  const o = await saveFarm({ name: 'Origin farm', status: 'prospect', ownerName: 'X', lat: origin.lat, lng: origin.lng, locationStatus: 'ok', locationSource: 'typed' })
  await saveFarm({ name: 'Close farm', status: 'prospect', ownerName: 'Y', lat: 34.498872, lng: -5.602563, locationStatus: 'ok', locationSource: 'typed' })
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[`/nearby?farm=${o.id}&r=10`]}>
        <Routes><Route path="/nearby" element={<NearbyPage />} /></Routes>
      </MemoryRouter>,
    )
    await wait(50)
  })
  for (let i = 0; i < 40 && !el.querySelector('.farm-map-canvas'); i++) await act(async () => { await wait(50) })
  expect(el.querySelector('.farm-map-canvas')).not.toBeNull()
  expect(el.textContent).toContain('Close farm')
  await act(async () => root.unmount())
})

test('ClusterLayer skips farms with NaN coordinates instead of crashing (M1)', async () => {
  const { MapContainer } = await import('react-leaflet')
  const { default: ClusterLayer } = await import('./ClusterLayer.jsx')
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  const errors = []
  const onError = (e) => { errors.push(e.error || e.message); e.preventDefault() }
  window.addEventListener('error', onError)
  try {
    await act(async () => {
      root.render(<MapContainer center={[35.4, -6]} zoom={11} maxZoom={19}><ClusterLayer farms={farms} /></MapContainer>)
      await wait()
    })
    expect(errors).toEqual([])
  } finally {
    window.removeEventListener('error', onError)
    await act(async () => root.unmount())
  }
})
