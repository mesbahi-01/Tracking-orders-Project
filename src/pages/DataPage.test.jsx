import { test, expect, vi, beforeEach } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import '../i18n.js'
import i18n from 'i18next'

const calls = []
vi.mock('../territory/backup', async (orig) => {
  const real = await orig()
  return {
    ...real,
    parseBackup: vi.fn(() => ({ meta: { exportedAt: '', appVersion: '0.8.0', counts: { customers: 1, farms: 1, orders: 0, dailyReports: 0 } } })),
    exportFullBackup: vi.fn(async () => { calls.push('export'); return { filename: 'farm-backup-x.xlsx' } }),
    restoreBackup: vi.fn(async (data, mode) => {
      calls.push(`restore:${mode}`)
      return { added: { customers: 1, farms: 1, orders: 0, dailyReports: 0 }, skipped: { customers: 0, farms: 0, orders: 0, dailyReports: 0 } }
    }),
  }
})
vi.mock('../territory/xlsxIO', async (orig) => ({ ...(await orig()), readWorkbook: vi.fn(async () => ({})) }))

const backup = await import('../territory/backup')
const { default: DataPage } = await import('./DataPage.jsx')

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms))
const btn = (el, text) => [...el.querySelectorAll('button')].find((b) => b.textContent === text)

beforeEach(() => { calls.length = 0; vi.clearAllMocks() })

async function openRestore() {
  await i18n.changeLanguage('en')
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  await act(async () => { root.render(<DataPage />); await wait() })
  const section = [...el.querySelectorAll('section')].find((s) => s.querySelector('h3')?.textContent === i18n.t('territory.data.restoreTitle'))
  const input = section.querySelector('input[type=file]')
  Object.defineProperty(input, 'files', { value: [{ name: 'b.xlsx' }], configurable: true })
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); await wait() })
  await act(async () => { btn(el, i18n.t('territory.backup.restore')).click(); await wait() })
  return { el, root }
}

test('Replace all offers "Export current data first" and exports before replacing (M5)', async () => {
  const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
  const { el, root } = await openRestore()
  expect(confirmSpy).not.toHaveBeenCalled()
  expect(calls).toEqual([]) // nothing happens until the user chooses
  expect(el.textContent).toContain(i18n.t('territory.backup.confirmReplace'))
  await act(async () => { btn(el, i18n.t('territory.backup.exportFirst')).click(); await wait(80) })
  expect(calls).toEqual(['export', 'restore:replace'])
  expect(el.textContent).toContain(i18n.t('territory.backup.resultTitle'))
  confirmSpy.mockRestore()
  await act(async () => root.unmount())
})

test('if the safety export fails, nothing is replaced', async () => {
  backup.exportFullBackup.mockImplementationOnce(async () => { calls.push('export'); throw new Error('disk full') })
  const { el, root } = await openRestore()
  await act(async () => { btn(el, i18n.t('territory.backup.exportFirst')).click(); await wait(80) })
  expect(calls).toEqual(['export'])
  expect(el.textContent).toContain('disk full')
  await act(async () => root.unmount())
})

test('Replace without exporting and Cancel', async () => {
  const { el, root } = await openRestore()
  await act(async () => { btn(el, i18n.t('territory.backup.cancelReplace')).click(); await wait() })
  expect(calls).toEqual([])
  expect(el.textContent).not.toContain(i18n.t('territory.backup.confirmReplace'))
  await act(async () => { btn(el, i18n.t('territory.backup.restore')).click(); await wait() })
  await act(async () => { btn(el, i18n.t('territory.backup.replaceNow')).click(); await wait(80) })
  expect(calls).toEqual(['restore:replace'])
  await act(async () => root.unmount())
})

test('add-missing result explains that records already on the phone were kept as they are (T10)', async () => {
  await i18n.changeLanguage('en')
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  await act(async () => { root.render(<DataPage />); await wait() })
  const section = [...el.querySelectorAll('section')].find((s) => s.querySelector('h3')?.textContent === i18n.t('territory.data.restoreTitle'))
  const input = section.querySelector('input[type=file]')
  Object.defineProperty(input, 'files', { value: [{ name: 'b.xlsx' }], configurable: true })
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); await wait() })
  await act(async () => { section.querySelector('input[value=add-missing]').click(); await wait() })
  await act(async () => { btn(el, i18n.t('territory.backup.restore')).click(); await wait(80) })
  expect(calls).toEqual(['restore:add-missing'])
  const note = i18n.t('territory.backup.addMissingKept')
  expect(note).not.toBe('territory.backup.addMissingKept')
  expect(el.textContent).toContain(note)
  await act(async () => root.unmount())
})
