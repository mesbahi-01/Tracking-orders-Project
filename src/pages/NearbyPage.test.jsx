import { test, expect, vi, beforeEach } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import L from 'leaflet'
import '../i18n.js'
import i18n from 'i18next'
import { resetAll } from '../test/resetDbs.js'

const fix = { current: { lat: 35.4, lng: -6.0, accuracy: undefined } }
vi.mock('../territory/geolocation', () => ({ getCurrentPosition: vi.fn(async () => fix.current) }))
const { default: NearbyPage } = await import('./NearbyPage.jsx')

globalThis.IS_REACT_ACT_ENVIRONMENT = true
L.Browser.svg = true // jsdom has no SVG renderer detection
beforeEach(resetAll)
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms))

async function render() {
  await i18n.changeLanguage('en')
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  await act(async () => {
    root.render(<MemoryRouter initialEntries={['/nearby?me=1&r=10']}><Routes><Route path="/nearby" element={<NearbyPage />} /></Routes></MemoryRouter>)
  })
  for (let i = 0; i < 40 && !el.querySelector('.farm-map-canvas'); i++) await act(async () => { await wait() })
  return { el, root }
}

const aboutText = (m) => i18n.t('territory.nearby.accuracy', { m })

test('GPS fix without a numeric accuracy does not show "about 0 m" (T9)', async () => {
  fix.current = { lat: 35.4, lng: -6.0, accuracy: undefined }
  const { el, root } = await render()
  expect(el.querySelector('.farm-map-canvas')).not.toBeNull()
  expect(el.textContent).not.toContain(aboutText(0))
  await act(async () => root.unmount())
})

test('GPS fix with an accuracy shows it', async () => {
  fix.current = { lat: 35.4, lng: -6.0, accuracy: 12.4 }
  const { el, root } = await render()
  expect(el.textContent).toContain(aboutText(12))
  await act(async () => root.unmount())
})
