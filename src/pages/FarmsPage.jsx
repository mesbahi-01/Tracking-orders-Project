import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTerritory } from '../territory/useTerritory'
import { applyFarmFilters } from '../territory/filters'
import { useFarmFilters, regionList } from '../territory/useFarmFilters'
import FilterPanel, { activeFilterCount } from '../components/territory/FilterPanel'
import { EmptyState, SearchField } from '../components/territory/ui'
import { IconPlus, IconFilter, IconPin, IconDownload, IconFarm } from '../components/territory/icons'
import { customerLabeler } from '../territory/customerLabel'

const NEEDS = ['missing', 'verify']

export default function FarmsPage() {
  const { t, i18n } = useTranslation()
  const { farms, customers, customersById, loading } = useTerritory()
  const [filters, setFilters] = useFarmFilters()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const nf = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language])
  const regions = useMemo(() => regionList(farms, customers), [farms, customers])
  const labelOf = useMemo(() => customerLabeler(customers), [customers])

  const shown = useMemo(() => {
    const list = applyFarmFilters(farms, customersById, filters)
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [farms, customersById, filters])

  const [exporting, setExporting] = useState(false)
  async function handleExport() {
    setExporting(true)
    try {
      // Loaded on demand so SheetJS stays out of the main bundle.
      const { downloadFarms } = await import('../territory/exporter')
      downloadFarms(shown, customersById)
    } catch (e) {
      console.error('Export failed:', e)
      window.alert(t('territory.export.failed', { message: e?.message || String(e) }))
    } finally {
      setExporting(false)
    }
  }

  const ls = filters.locationStatuses
  const needsLocation = ls.length === NEEDS.length && NEEDS.every((s) => ls.includes(s))
  const filterCount = activeFilterCount({ ...filters, text: '' })

  if (loading) return <p className="territory-muted">{t('loading')}</p>

  return (
    <div className="territory-page">
      <div className="territory-head">
        <h2>{t('territory.nav.farms')}</h2>
        <Link className="territory-btn btn-primary" to="/farms/new"><IconPlus size={18} />{t('territory.farms.add')}</Link>
      </div>

      <SearchField value={filters.text} onChange={(e) => setFilters({ ...filters, text: e.target.value })}
        placeholder={t('territory.farms.search')} aria-label={t('territory.farms.search')} />
      <div className="chip-row chip-scroll">
        <button type="button" className={`chip${filterCount ? ' btn-primary' : ''}`} aria-expanded={filtersOpen} onClick={() => setFiltersOpen((v) => !v)}>
          <IconFilter size={18} />{t('territory.filters.title')}{filterCount ? ` (${filterCount})` : ''}
        </button>
        <button type="button" className={`chip${needsLocation ? ' btn-primary' : ''}`} aria-pressed={needsLocation}
          onClick={() => setFilters({ ...filters, locationStatuses: needsLocation ? [] : NEEDS })}>
          <IconPin size={18} />{t('territory.farms.needsLocation')}
        </button>
        <button type="button" className="chip" onClick={handleExport} disabled={exporting || shown.length === 0}>
          <IconDownload size={18} />{exporting ? t('territory.export.exporting') : t('territory.export.filtered', { count: shown.length })}
        </button>
      </div>
      <FilterPanel value={filters} onChange={setFilters} regions={regions} customers={customers} hideText inline
        open={filtersOpen} onClose={() => setFiltersOpen(false)} />

      <p className="territory-count">{t('territory.farms.count', { count: shown.length })}</p>
      {shown.length === 0 ? <EmptyState icon={<IconFarm size={28} />} title={t('territory.farms.empty')} /> : (
        <ul className="territory-list">
          {shown.map((f) => {
            const lsx = f.locationStatus || 'missing'
            const customer = f.customerId ? customersById[f.customerId] : null
            return (
              <li key={f.id}>
                <Link to={`/farms/${f.id}`} className={`territory-row row-${f.status}`}>
                  <span className="territory-row-main">
                    <strong dir="auto">{f.name}</strong>
                    <span className="territory-muted"><bdi>{(customer && labelOf(customer)) || f.ownerName || '—'}</bdi> · {t(`territory.farms.status.${f.status}`)}</span>
                  </span>
                  <span className="territory-row-side">
                    <span className="row-num">{typeof f.capacity === 'number' ? nf.format(f.capacity) : '—'}</span>
                    <span className={`territory-badge badge-${lsx}`}>{t(`territory.farms.location.${lsx}`)}</span>
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
