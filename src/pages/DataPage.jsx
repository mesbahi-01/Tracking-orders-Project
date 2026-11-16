import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getSetting, listCustomers, listFarms } from '../territory/store'
import { readWorkbook } from '../territory/xlsxIO'
import { backupAgeDays, exportFullBackup, parseBackup, restoreBackup } from '../territory/backup'
import { downloadCustomers, downloadFarms } from '../territory/exporter'
import ImportWizard from '../components/territory/ImportWizard'
import { IconShield, IconRestore, IconSheet, IconDownload, IconUpload } from '../components/territory/icons'

function SectionHead({ icon, title, tone }) {
  return (
    <div className="data-head">
      <span className={`data-head-icon${tone ? ` is-${tone}` : ''}`} aria-hidden="true">{icon}</span>
      <h3>{title}</h3>
    </div>
  )
}

const SHEET_KEYS = [
  ['customers', 'sheetCustomers'],
  ['farms', 'sheetFarms'],
  ['orders', 'sheetOrders'],
  ['dailyReports', 'sheetDailyReports'],
]

function errorText(t, e, fallbackKey) {
  if (e?.name === 'RestoreError' && e.code === 'reports-partial') return t('territory.backup.errorReportsPartial')
  if (e?.name === 'BackupFormatError') {
    if (e.code === 'not-a-backup') return t('territory.backup.errorNotABackup')
    if (e.code === 'schema') return t('territory.backup.errorSchema')
    if (e.code === 'coordinates') return t('territory.backup.errorCoordinates', { name: e.farmName || '?' })
    return t('territory.backup.errorDamaged')
  }
  return t(fallbackKey, { message: e?.message || String(e) })
}

function BackupSection() {
  const { t } = useTranslation()
  const [lastBackupAt, setLastBackupAt] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  const refresh = useCallback(() => {
    getSetting('lastBackupAt').then((v) => setLastBackupAt(v ?? null)).catch(() => {})
  }, [])
  useEffect(refresh, [refresh])

  async function handleExport() {
    setBusy(true)
    setMessage(null)
    try {
      const { filename } = await exportFullBackup()
      setMessage({ ok: true, text: t('territory.backup.exported', { filename }) })
    } catch (e) {
      console.error('Backup failed:', e)
      setMessage({ ok: false, text: t('territory.backup.exportFailed', { message: e?.message || String(e) }) })
    } finally {
      setBusy(false)
      refresh()
    }
  }

  const days = backupAgeDays(lastBackupAt)
  const ageText = days === null
    ? t('territory.backup.lastBackupNever')
    : days === 0 ? t('territory.backup.lastBackupToday') : t('territory.backup.lastBackup', { count: days })

  return (
    <section className="data-section surface-card">
      <SectionHead icon={<IconShield size={20} />} title={t('territory.data.backupTitle')} tone={days === null || days > 7 ? 'warn' : null} />
      <p className="territory-muted">{t('territory.data.backupHint')}</p>
      <button type="button" className="territory-btn btn-primary" onClick={handleExport} disabled={busy}>
        <IconDownload size={18} />{busy ? t('territory.backup.exporting') : t('territory.backup.export')}
      </button>
      <p className={`data-age${days === null || days > 7 ? ' is-warn' : ''}`}>{ageText}</p>
      {message && <p className={message.ok ? 'data-ok' : 'data-error'} role="status">{message.text}</p>}
    </section>
  )
}

function RestoreSection() {
  const { t, i18n } = useTranslation()
  const [pending, setPending] = useState(null) // parsed backup
  const [mode, setMode] = useState('replace')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [confirmReplace, setConfirmReplace] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPending(null)
    setResult(null)
    setError(null)
    setConfirmReplace(false)
    setBusy(true)
    try {
      const wb = await readWorkbook(file)
      setPending(parseBackup(wb))
      setMode('replace')
    } catch (err) {
      console.error('Could not read backup:', err)
      setError(errorText(t, err, 'territory.backup.errorRead'))
    } finally {
      setBusy(false)
    }
  }

  function handleRestore() {
    if (!pending) return
    // Replace all asks first, offering a safety export of what is on the phone now.
    if (mode === 'replace') { setError(null); setConfirmReplace(true); return }
    runRestore(false)
  }

  async function runRestore(exportFirst) {
    if (!pending) return
    setConfirmReplace(false)
    setBusy(true)
    setError(null)
    if (exportFirst) {
      try {
        await exportFullBackup()
      } catch (err) {
        console.error('Safety export failed:', err)
        setError(t('territory.backup.exportFirstFailed', { message: err?.message || String(err) }))
        setBusy(false)
        return
      }
    }
    try {
      setResult({ ...(await restoreBackup(pending, mode)), mode })
      setPending(null)
    } catch (err) {
      console.error('Restore failed:', err)
      setError(errorText(t, err, 'territory.backup.restoreFailed'))
    } finally {
      setBusy(false)
    }
  }

  const exportedAt = pending?.meta.exportedAt ? new Date(pending.meta.exportedAt) : null
  const dateText = exportedAt && !Number.isNaN(exportedAt.getTime())
    ? exportedAt.toLocaleString(i18n.language)
    : pending?.meta.exportedAt || '?'

  return (
    <section className="data-section surface-card">
      <SectionHead icon={<IconRestore size={20} />} title={t('territory.data.restoreTitle')} />
      <label className="territory-btn data-file">
        <IconUpload size={18} />{busy && !pending ? t('territory.backup.reading') : t('territory.backup.pickFile')}
        <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={handleFile} disabled={busy} />
      </label>

      {pending && (
        <div className="data-restore">
          <p>{t('territory.backup.fileSummary', { date: dateText, version: pending.meta.appVersion || '?' })}</p>
          <ul>
            {SHEET_KEYS.map(([key, label]) => (
              <li key={key}>{t(`territory.backup.${label}`)}: {pending.meta.counts[key]}</li>
            ))}
          </ul>
          <fieldset className="data-modes">
            <label>
              <input type="radio" name="restore-mode" value="replace" checked={mode === 'replace'} onChange={() => { setMode('replace'); setConfirmReplace(false) }} />
              <span><strong>{t('territory.backup.modeReplace')}</strong><br />
                <small className="territory-muted">{t('territory.backup.modeReplaceHint')}</small></span>
            </label>
            <label>
              <input type="radio" name="restore-mode" value="add-missing" checked={mode === 'add-missing'} onChange={() => { setMode('add-missing'); setConfirmReplace(false) }} />
              <span><strong>{t('territory.backup.modeAdd')}</strong><br />
                <small className="territory-muted">{t('territory.backup.modeAddHint')}</small></span>
            </label>
          </fieldset>
          {confirmReplace ? (
            <div className="territory-warning data-confirm" role="alertdialog" aria-label={t('territory.backup.modeReplace')}>
              <p>{t('territory.backup.confirmReplace')}</p>
              <div className="territory-actions">
                <button type="button" className="territory-btn btn-primary" onClick={() => runRestore(true)}>{t('territory.backup.exportFirst')}</button>
                <button type="button" className="territory-btn" onClick={() => runRestore(false)}>{t('territory.backup.replaceNow')}</button>
                <button type="button" className="territory-btn" onClick={() => setConfirmReplace(false)}>{t('territory.backup.cancelReplace')}</button>
              </div>
            </div>
          ) : (
            <button type="button" className="territory-btn btn-primary" onClick={handleRestore} disabled={busy}>
              {busy ? t('territory.backup.restoring') : t('territory.backup.restore')}
            </button>
          )}
        </div>
      )}

      {error && <p className="data-error" role="alert">{error}</p>}

      {result && (
        <div className="data-ok" role="status">
          <p><strong>{t('territory.backup.resultTitle')}</strong></p>
          <ul>
            {SHEET_KEYS.map(([key, label]) => (
              <li key={key}>{t('territory.backup.resultLine', {
                sheet: t(`territory.backup.${label}`), added: result.added[key], skipped: result.skipped[key],
              })}</li>
            ))}
          </ul>
          {result.mode === 'add-missing' && <p className="territory-muted">{t('territory.backup.addMissingKept')}</p>}
          <button type="button" className="territory-btn" onClick={() => window.location.reload()}>
            {t('territory.backup.reloadApp')}
          </button>
        </div>
      )}
    </section>
  )
}

function ImportSection() {
  const { t } = useTranslation()
  return (
    <section className="data-section surface-card">
      <SectionHead icon={<IconSheet size={20} />} title={t('territory.import.title')} />
      <ImportWizard />
    </section>
  )
}

function ExportSection() {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function run(kind) {
    setBusy(true)
    setError(null)
    try {
      const [customers, farms] = await Promise.all([listCustomers(), listFarms()])
      if (kind === 'farms') {
        downloadFarms(farms, Object.fromEntries(customers.map((c) => [c.id, c])))
      } else {
        downloadCustomers(customers, farms)
      }
    } catch (e) {
      console.error('Export failed:', e)
      setError(t('territory.export.failed', { message: e?.message || String(e) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="data-section surface-card">
      <SectionHead icon={<IconDownload size={20} />} title={t('territory.export.title')} />
      <p className="territory-muted">{t('territory.export.hint')}</p>
      <div className="territory-actions">
        <button type="button" className="territory-btn" onClick={() => run('farms')} disabled={busy}><IconDownload size={18} />{t('territory.export.allFarms')}</button>
        <button type="button" className="territory-btn" onClick={() => run('customers')} disabled={busy}><IconDownload size={18} />{t('territory.export.allCustomers')}</button>
      </div>
      {error && <p className="data-error" role="alert">{error}</p>}
    </section>
  )
}

export default function DataPage() {
  const { t } = useTranslation()
  return (
    <div className="territory-page data-page">
      <h2>{t('territory.nav.data')}</h2>
      <BackupSection />
      <RestoreSection />
      <ImportSection />
      <ExportSection />
    </div>
  )
}
