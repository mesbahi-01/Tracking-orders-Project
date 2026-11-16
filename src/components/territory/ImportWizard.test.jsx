import { test, expect, beforeEach } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import * as XLSX from 'xlsx'
import '../../i18n.js'
import i18n from 'i18next'
import { resetAll } from '../../test/resetDbs.js'
import { listFarms } from '../../territory/store.js'
import { buildSeedWorkbook } from '../../../scripts/make-seed-xlsx.mjs'
import ImportWizard from './ImportWizard.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
beforeEach(resetAll)

const wait = (ms = 50) => new Promise((r) => setTimeout(r, ms))
const btn = (el, text) => [...el.querySelectorAll('button')].find((b) => b.textContent.includes(text))

async function runWizard(el) {
  const buf = XLSX.write(buildSeedWorkbook(), { type: 'array', bookType: 'xlsx' })
  const file = { name: 'seed.xlsx', arrayBuffer: async () => buf }
  const input = el.querySelector('input[type=file]')
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); await wait(200) })
  await act(async () => { btn(el, 'Next').click(); await wait() })
  expect(el.querySelector('table').textContent).toContain('مزرعة الأمل')
  await act(async () => { btn(el, 'Next').click(); await wait() })
  expect(el.querySelectorAll('select').length).toBe(13)
  await act(async () => { btn(el, 'Next').click(); await wait(200) })
}

// UI smoke test: the matching card blocks Next until the user decides.
test('wizard end to end, then re-import requires a decision', async () => {
  await i18n.changeLanguage('en')
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  await act(async () => { root.render(<ImportWizard />) })
  await runWizard(el)
  expect(el.textContent).toContain('None of these customers exist yet')
  await act(async () => { btn(el, 'Next').click(); await wait() })
  expect(el.textContent).toContain('No duplicates found')
  await act(async () => { btn(el, 'Import').click(); await wait(300) })
  expect(el.textContent).toContain('8 farms created')
  expect(await listFarms()).toHaveLength(8)

  await act(async () => { btn(el, 'Import another file').click(); await wait() })
  await runWizard(el)
  expect(el.textContent).toContain('Client Démo')
  const next = btn(el, 'Next')
  expect(next.disabled).toBe(true)
  await act(async () => { btn(el, 'Same customer').click(); await wait() })
  expect(btn(el, 'Next').disabled).toBe(false)
  await act(async () => { btn(el, 'Next').click(); await wait() })
  expect(el.querySelectorAll('input[type=radio][value=skip]:checked').length).toBe(8)
  expect(el.querySelectorAll('input[type=radio][value=update]').length).toBe(8)
  await act(async () => { btn(el, 'Import').click(); await wait(300) })
  expect(el.textContent).toContain('8 farms skipped')
  expect(await listFarms()).toHaveLength(8)
  root.unmount()
})
