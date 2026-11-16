import { test, expect, beforeEach } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import './i18n.js'
import i18n from 'i18next'
import { resetAll } from './test/resetDbs.js'
import { saveCustomer } from './territory/store.js'
import App from './App.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
beforeEach(resetAll)

const wait = (ms = 50) => new Promise((r) => setTimeout(r, ms))

async function renderAt(path) {
  localStorage.setItem('auth_user', JSON.stringify({ username: 'u', password: 'p' }))
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
  })
  for (let i = 0; i < 40 && /Loading/.test(el.textContent); i++) {
    await act(async () => { await wait(50) })
  }
  await act(async () => { await wait(50) })
  return { el, root }
}

test('/customers renders the real customers list, not a placeholder', async () => {
  await i18n.changeLanguage('en')
  await saveCustomer({ name: 'Routing Test Customer' })
  const { el, root } = await renderAt('/customers')
  expect(el.textContent).not.toContain('Coming soon')
  expect(el.querySelector('input[type=search]')).not.toBeNull()
  expect(el.textContent).toContain('Routing Test Customer')
  await act(async () => root.unmount())
})

test('/customers/:id renders the customer profile', async () => {
  await i18n.changeLanguage('en')
  const c = await saveCustomer({ name: 'Profile Routing Customer', phone: '0600000000' })
  const { el, root } = await renderAt(`/customers/${c.id}`)
  expect(el.textContent).not.toContain('Coming soon')
  expect(el.textContent).toContain('Profile Routing Customer')
  expect(el.textContent).toContain('0600000000')
  await act(async () => root.unmount())
})

test('/customers/new renders the customer form', async () => {
  await i18n.changeLanguage('en')
  const { el, root } = await renderAt('/customers/new')
  expect(el.textContent).not.toContain('Coming soon')
  expect(el.querySelector('form')).not.toBeNull()
  await act(async () => root.unmount())
})

test('an upgrade blocked by another tab shows a message with a reload button, not Loading forever', async () => {
  await i18n.changeLanguage('en')
  const old = await new Promise((resolve, reject) => {
    const req = indexedDB.open('orders-db', 2)
    req.onupgradeneeded = () => req.result.createObjectStore('orders', { keyPath: 'id', autoIncrement: true })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  const { el, root } = await renderAt('/customers')
  expect(el.textContent).toContain(i18n.t('dbBlocked.title'))
  expect(i18n.t('dbBlocked.title')).not.toBe('dbBlocked.title')
  expect([...el.querySelectorAll('button')].some((b) => b.textContent === i18n.t('dbBlocked.reload'))).toBe(true)

  old.close()
  for (let i = 0; i < 40 && !el.querySelector('input[type=search]'); i++) await act(async () => { await wait(50) })
  expect(el.querySelector('input[type=search]')).not.toBeNull()
  await act(async () => root.unmount())
})
