import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { customerOptionLabel } from '../../territory/customerLabel'
import { IconFilter, IconClose } from './icons'

const STATUSES = ['customer', 'prospect', 'competitor']
const LOCATION_STATUSES = ['ok', 'verify', 'missing']

export function activeFilterCount(v) {
  return (v.text ? 1 : 0) + (v.customerId ? 1 : 0) + (v.statuses?.length ? 1 : 0) + (v.region ? 1 : 0)
    + (typeof v.capMin === 'number' ? 1 : 0) + (typeof v.capMax === 'number' ? 1 : 0) + (v.locationStatuses?.length ? 1 : 0)
}

const toggle = (list = [], x) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x])
const numOrNull = (s) => (s === '' || !Number.isFinite(Number(s)) ? null : Number(s))

// Uncontrolled collapse by default; pass `open` + `onClose` to control it from outside: a floating
// sheet (map page), or an in-page card with `inline` (farms page, whose toolbar holds the toggle).
export default function FilterPanel({ value, onChange, regions = [], customers = [], open, onClose, hideText = false, inline = false }) {
  const { t } = useTranslation()
  const [inner, setInner] = useState(false)
  const controlled = open !== undefined
  const isOpen = controlled ? open : inner
  const set = (patch) => onChange({ ...value, ...patch })
  const count = activeFilterCount(value)

  const body = (
    <div className="filter-panel-body">
      {!hideText && (
        <input type="search" value={value.text || ''} onChange={(e) => set({ text: e.target.value })}
          placeholder={t('territory.farms.search')} aria-label={t('territory.farms.search')} />
      )}
      <label>{t('territory.filters.customer')}
        <select value={value.customerId || ''} onChange={(e) => set({ customerId: e.target.value })}>
          <option value="">{t('territory.filters.allCustomers')}</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{customerOptionLabel(c)}</option>)}
        </select>
      </label>
      <div className="chip-row" role="group" aria-label={t('territory.farms.form.status')}>
        {STATUSES.map((s) => (
          <button key={s} type="button" className={`chip chip-status chip-${s}${value.statuses?.includes(s) ? ' btn-primary' : ''}`}
            aria-pressed={!!value.statuses?.includes(s)} onClick={() => set({ statuses: toggle(value.statuses, s) })}>
            {t(`territory.farms.status.${s}`)}
          </button>
        ))}
      </div>
      <label>{t('territory.filters.region')}
        <select value={value.region || ''} onChange={(e) => set({ region: e.target.value })}>
          <option value="">{t('territory.customers.allRegions')}</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <div className="filter-cap">
        <label>{t('territory.filters.capMin')}
          <input type="number" inputMode="numeric" min="0" value={value.capMin ?? ''} onChange={(e) => set({ capMin: numOrNull(e.target.value) })} />
        </label>
        <label>{t('territory.filters.capMax')}
          <input type="number" inputMode="numeric" min="0" value={value.capMax ?? ''} onChange={(e) => set({ capMax: numOrNull(e.target.value) })} />
        </label>
      </div>
      <div className="chip-row" role="group" aria-label={t('territory.location.title')}>
        {LOCATION_STATUSES.map((s) => (
          <button key={s} type="button" className={`chip${value.locationStatuses?.includes(s) ? ' btn-primary' : ''}`}
            aria-pressed={!!value.locationStatuses?.includes(s)} onClick={() => set({ locationStatuses: toggle(value.locationStatuses, s) })}>
            {t(`territory.farms.location.${s}`)}
          </button>
        ))}
      </div>
      <div className="territory-actions filter-panel-actions">
        <button type="button" className="territory-btn btn-ghost" disabled={count === 0} onClick={() => onChange({ text: '', customerId: '', statuses: [], region: '', capMin: null, capMax: null, locationStatuses: [] })}>
          {t('territory.filters.clear')}
        </button>
        {controlled && <button type="button" className="territory-btn btn-primary" onClick={onClose}>{t('territory.filters.done')}</button>}
      </div>
    </div>
  )

  const head = (
    <div className="filter-panel-head">
      <h3>{t('territory.filters.title')}</h3>
      {controlled && (
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t('territory.map.close')}><IconClose size={20} /></button>
      )}
    </div>
  )

  if (controlled) {
    if (!isOpen) return null
    return inline
      ? <div className="filter-panel filter-inline surface-card" role="region" aria-label={t('territory.filters.title')}>{head}{body}</div>
      : <div className="filter-panel filter-sheet" role="dialog" aria-label={t('territory.filters.title')}><span className="sheet-handle" aria-hidden="true" />{head}{body}</div>
  }
  return (
    <div className="filter-panel">
      <button type="button" className={`chip${count > 0 ? ' btn-primary' : ''}`} aria-expanded={isOpen} onClick={() => setInner((v) => !v)}>
        <IconFilter size={18} />{t('territory.filters.title')}{count > 0 ? ` (${count})` : ''}
      </button>
      {isOpen && <div className="filter-inline surface-card">{body}</div>}
    </div>
  )
}
