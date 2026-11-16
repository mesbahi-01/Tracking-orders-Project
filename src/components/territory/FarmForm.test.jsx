import { test, expect, beforeEach } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import '../../i18n.js'
import i18n from 'i18next'
import { resetAll } from '../../test/resetDbs.js'
import { listFarms } from '../../territory/store.js'
import FarmForm from './FarmForm.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
beforeEach(resetAll)

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms))

function setInput(input, value) {
  const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
const labelled = (el, text) => [...el.querySelectorAll('label')].find((l) => l.textContent.startsWith(text))?.querySelector('input, textarea, select')

async function mount(initial = {}) {
  await i18n.changeLanguage('en')
  const saved = []
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  await act(async () => {
    root.render(<FarmForm initial={initial} onSaved={(f) => saved.push(f)} onCancel={() => {}} />)
    await wait(100)
  })
  return { el, root, saved }
}

async function typeChars(input, text) {
  for (let i = 1; i <= text.length; i++) {
    await act(async () => { setInput(input, text.slice(0, i)) })
  }
}

test('typing "35,4" in the paste box never fills lat/lng and blocks save', async () => {
  const { el, root, saved } = await mount()
  await act(async () => { setInput(labelled(el, 'Farm name'), 'Paste farm') })
  const paste = labelled(el, 'Paste coordinates')
  const lat = labelled(el, 'Latitude')
  const lng = labelled(el, 'Longitude')

  // per keystroke: "3", "35", "35,", "35,4" must not set (35,4) — nor (3,?) etc.
  await typeChars(paste, '35,4')
  expect(lat.value).toBe('')
  expect(lng.value).toBe('')

  await act(async () => { paste.dispatchEvent(new FocusEvent('blur', { bubbles: false })); paste.dispatchEvent(new FocusEvent('focusout', { bubbles: true })) })
  expect(el.textContent).toContain('Could not read coordinates from this text')
  expect(lat.value).toBe('')

  await act(async () => { el.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await wait(100) })
  expect(saved).toHaveLength(0)
  expect(await listFarms()).toHaveLength(0)
  await act(async () => root.unmount())
})

test('a paste error blocks saving even when lat/lng were already filled', async () => {
  const { el, root, saved } = await mount({ name: 'Existing', status: 'prospect', lat: 35.1, lng: -6.1 })
  const paste = labelled(el, 'Paste coordinates')
  await typeChars(paste, '35,41')
  await act(async () => { paste.dispatchEvent(new FocusEvent('focusout', { bubbles: true })) })
  expect(labelled(el, 'Latitude').value).toBe('35.1')
  await act(async () => { el.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await wait(100) })
  expect(saved).toHaveLength(0)
  expect(el.textContent).toContain(i18n.t('territory.location.err.pasteBlocking'))
  await act(async () => root.unmount())
})

test('a valid pasted pair is applied on blur and saved', async () => {
  const { el, root, saved } = await mount()
  await act(async () => { setInput(labelled(el, 'Farm name'), 'Good farm') })
  const paste = labelled(el, 'Paste coordinates')
  await typeChars(paste, '34.5185, -5.62')
  // not parsed per keystroke ("34.5185, -5.6" would have been applied mid-typing)
  expect(labelled(el, 'Latitude').value).toBe('')
  await act(async () => { paste.dispatchEvent(new FocusEvent('focusout', { bubbles: true })) })
  expect(labelled(el, 'Latitude').value).toBe('34.5185')
  expect(labelled(el, 'Longitude').value).toBe('-5.62')
  await act(async () => { el.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await wait(150) })
  expect(saved).toHaveLength(1)
  expect(saved[0]).toMatchObject({ lat: 34.5185, lng: -5.62 })
  await act(async () => root.unmount())
})

test('a second farm with the same name for the same owner is blocked with a message naming it', async () => {
  const { saveFarm } = await import('../../territory/store.js')
  await saveFarm({ name: 'Ain Amal', status: 'prospect', ownerName: 'Ali' })
  const { el, root, saved } = await mount({ status: 'prospect', ownerName: 'ali' })
  await act(async () => { setInput(labelled(el, 'Farm name'), '  AIN  amal ') })
  const msg = i18n.t('territory.farms.form.nameTaken', { name: 'Ain Amal' })
  for (let i = 0; i < 40 && !el.textContent.includes(msg); i++) await act(async () => { await wait(25) })
  expect(el.textContent).toContain(msg)
  await act(async () => { el.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await wait(100) })
  expect(saved).toHaveLength(0)
  expect(await listFarms()).toHaveLength(1)

  await act(async () => { setInput(labelled(el, 'Farm name'), 'Ain Amal 2') })
  expect(el.textContent).not.toContain(msg)
  await act(async () => { el.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await wait(150) })
  expect(saved).toHaveLength(1)
  await act(async () => root.unmount())
})

test('the location error from Save clears as soon as the location is corrected (T7)', async () => {
  const { el, root } = await mount()
  await act(async () => { setInput(labelled(el, 'Farm name'), 'T7 farm') })
  await act(async () => { setInput(labelled(el, 'Latitude'), '35.4') })
  await act(async () => { el.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await wait(50) })
  const partial = i18n.t('territory.location.err.partial')
  const count = () => el.textContent.split(partial).length - 1
  expect(count()).toBe(2) // live field message + the Save error
  await act(async () => { setInput(labelled(el, 'Longitude'), '-6.0') })
  expect(count()).toBe(0)
  await act(async () => root.unmount())
})
