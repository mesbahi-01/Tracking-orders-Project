import { test, expect, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import '../i18n.js'
import i18n from 'i18next'
import ErrorBoundary from './ErrorBoundary.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function Boom() { throw new Error('kaboom') }

test('a crashing page shows a translated message instead of a blank app', async () => {
  await i18n.changeLanguage('en')
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  const onError = (e) => e.preventDefault()
  window.addEventListener('error', onError)
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  try {
    await act(async () => {
      root.render(<MemoryRouter><p>nav stays</p><ErrorBoundary><Boom /></ErrorBoundary></MemoryRouter>)
    })
    expect(el.textContent).toContain('nav stays')
    expect(el.textContent).toContain(i18n.t('errorBoundary.title'))
    expect(i18n.t('errorBoundary.title')).not.toBe('errorBoundary.title')
    expect(el.querySelector('[role=alert] button')).not.toBeNull()
    await act(async () => { await i18n.changeLanguage('fr') })
    expect(el.textContent).toContain(i18n.t('errorBoundary.title'))
  } finally {
    window.removeEventListener('error', onError)
    spy.mockRestore()
    await act(async () => root.unmount())
    await i18n.changeLanguage('en')
  }
})

test('a crashed page is retried when resetKey changes (same path, new query)', async () => {
  await i18n.changeLanguage('en')
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  const onError = (e) => e.preventDefault()
  window.addEventListener('error', onError)
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  const Page = ({ crash }) => (crash ? <Boom /> : <p>page ok</p>)
  try {
    await act(async () => { root.render(<MemoryRouter><ErrorBoundary resetKey="/nearby?farm=a"><Page crash /></ErrorBoundary></MemoryRouter>) })
    expect(el.textContent).toContain(i18n.t('errorBoundary.title'))
    await act(async () => { root.render(<MemoryRouter><ErrorBoundary resetKey="/nearby?farm=b"><Page /></ErrorBoundary></MemoryRouter>) })
    expect(el.textContent).toContain('page ok')
  } finally {
    window.removeEventListener('error', onError)
    spy.mockRestore()
    await act(async () => root.unmount())
  }
})
