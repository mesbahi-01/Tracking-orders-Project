import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { version } from '../../package.json'
import { downloadDataCopy } from '../lib/dataCopy'

export default function DataCopyButton() {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function onClick() {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const counts = await downloadDataCopy(version)
      setMessage(t('dataCopy.done', { orders: counts.orders, reports: counts.dailyReports }))
    } catch (e) {
      console.error('Data copy failed:', e)
      setMessage(t('dataCopy.failed', { message: e?.message || String(e) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="data-copy">
      <button type="button" className="data-copy-btn" onClick={onClick} disabled={busy}>
        {busy ? t('dataCopy.working') : t('dataCopy.button')}
      </button>
      {message && <p className="data-copy-msg" role="status">{message}</p>}
    </div>
  )
}
