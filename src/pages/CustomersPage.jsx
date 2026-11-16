import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTerritory } from '../territory/useTerritory'
import { normalizeName } from '../territory/normalize'
import { totalsByCustomer } from '../territory/customerStats'
import { EmptyState, SearchField } from '../components/territory/ui'
import { IconPlus, IconDownload, IconCustomers } from '../components/territory/icons'

const EMPTY = { farmCount: 0, capacity: 0, unknown: 0, known: 0 }
// First letter for the avatar (Arabic and Latin alike).
const initial = (name) => (Array.from((name || '').trim())[0] || '?').toUpperCase()

export default function CustomersPage() {
  const { t, i18n } = useTranslation()
  const { customers, farms, loading } = useTerritory()
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('')
  const [sort, setSort] = useState('name')
  const nf = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language])

  const totals = useMemo(() => totalsByCustomer(farms), [farms])
  const regions = useMemo(() => [...new Set(customers.map((c) => c.region).filter(Boolean))].sort(), [customers])
  const nameCounts = useMemo(() => {
    const m = {}
    for (const c of customers) m[c.nameKey] = (m[c.nameKey] || 0) + 1
    return m
  }, [customers])

  const rows = useMemo(() => {
    const totalOf = (id) => totals[id] || EMPTY
    const q = normalizeName(search)
    const list = customers.filter((c) => (!q || c.nameKey.includes(q)) && (!region || c.region === region))
    const cmp = {
      name: (a, b) => a.name.localeCompare(b.name),
      farms: (a, b) => totalOf(b.id).farmCount - totalOf(a.id).farmCount || a.name.localeCompare(b.name),
      capacity: (a, b) => totalOf(b.id).capacity - totalOf(a.id).capacity || a.name.localeCompare(b.name),
    }[sort]
    return [...list].sort(cmp)
  }, [customers, totals, search, region, sort])

  const [exporting, setExporting] = useState(false)
  async function handleExport() {
    setExporting(true)
    try {
      // Loaded on demand so SheetJS stays out of the main bundle.
      const { downloadCustomers } = await import('../territory/exporter')
      downloadCustomers(rows, farms)
    } catch (e) {
      console.error('Export failed:', e)
      window.alert(t('territory.export.failed', { message: e?.message || String(e) }))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="territory-page">
      <div className="territory-head">
        <h2>{t('territory.nav.customers')}</h2>
        <Link className="btn-primary territory-btn" to="/customers/new"><IconPlus size={18} />{t('territory.customers.add')}</Link>
      </div>
      <SearchField value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder={t('territory.customers.search')} aria-label={t('territory.customers.search')} />
      <div className="territory-filters">
        <select value={region} onChange={(e) => setRegion(e.target.value)} aria-label={t('territory.customers.region')}>
          <option value="">{t('territory.customers.allRegions')}</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('territory.customers.sort')}>
          <option value="name">{t('territory.customers.sortName')}</option>
          <option value="farms">{t('territory.customers.sortFarms')}</option>
          <option value="capacity">{t('territory.customers.sortCapacity')}</option>
        </select>
      </div>
      <div className="chip-row chip-scroll">
        <button type="button" className="chip" onClick={handleExport} disabled={loading || exporting || rows.length === 0}>
          <IconDownload size={18} />{exporting ? t('territory.export.exporting') : t('territory.export.filtered', { count: rows.length })}
        </button>
      </div>
      {loading ? <p className="territory-muted">{t('loading')}</p> : rows.length === 0 ? (
        <EmptyState icon={<IconCustomers size={28} />} title={t('territory.customers.empty')} />
      ) : (
        <ul className="territory-list">
          {rows.map((c) => {
            const tot = totals[c.id] || EMPTY
            return (
              <li key={c.id}>
                <Link to={`/customers/${c.id}`} className="territory-row row-avatar">
                  <span className="avatar" aria-hidden="true">{initial(c.name)}</span>
                  <span className="territory-row-main">
                    <strong dir="auto">{c.name}</strong>
                    <span className="territory-muted">
                      {[c.region, nameCounts[c.nameKey] > 1 ? c.phone : ''].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="territory-row-side">
                    <span className="row-num">{tot.known > 0 ? nf.format(tot.capacity) : '—'}</span>
                    <span className="territory-muted">{t('territory.customers.farmCount', { count: tot.farmCount })}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
