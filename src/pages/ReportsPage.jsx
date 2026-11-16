import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTerritory } from '../territory/useTerritory'
import { applyFarmFilters } from '../territory/filters'
import { computeStats, prospectsNearCustomers } from '../territory/stats'
import { useFarmFilters, regionList } from '../territory/useFarmFilters'
import FilterPanel from '../components/territory/FilterPanel'
import BarChart from '../components/territory/BarChart'
import { customerLabel } from '../territory/customerLabel'
import { IconDownload } from '../components/territory/icons'

const stamp = () => new Date().toISOString().slice(0, 10)

function ExportButton({ name, headers, rows, file }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  async function go() {
    setBusy(true)
    try {
      // Loaded on demand so SheetJS stays out of the main bundle.
      const { downloadSection } = await import('../territory/sectionExport')
      downloadSection(name, headers, rows, `${file}-${stamp()}.xlsx`)
    } catch (e) {
      console.error('Export failed:', e)
      window.alert(t('territory.export.failed', { message: e?.message || String(e) }))
    } finally {
      setBusy(false)
    }
  }
  return (
    <button type="button" className="chip chip-sm" onClick={go} disabled={busy || rows.length === 0}>
      <IconDownload size={16} />{busy ? t('territory.export.exporting') : t('territory.reports.export')}
    </button>
  )
}

function Section({ title, children, exportProps }) {
  return (
    <section className="territory-section surface-card">
      <div className="section-head"><h3>{title}</h3><ExportButton {...exportProps} /></div>
      {children}
    </section>
  )
}

export default function ReportsPage() {
  const { t, i18n } = useTranslation()
  const { farms, customers, customersById, loading } = useTerritory()
  const [filters, setFilters] = useFarmFilters()
  const nf = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language])
  const nf1 = useMemo(() => new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), [i18n.language])
  const regions = useMemo(() => regionList(farms, customers), [farms, customers])
  const scoped = useMemo(() => applyFarmFilters(farms, customersById, filters), [farms, customersById, filters])
  const stats = useMemo(() => computeStats(customers, scoped), [customers, scoped])
  const prospects = useMemo(() => {
    const ids = new Set(scoped.map((f) => f.id))
    return prospectsNearCustomers(farms, 10).filter((p) => ids.has(p.farm.id))
  }, [farms, scoped])

  if (loading) return <p className="territory-muted">{t('loading')}</p>

  const R = 'territory.reports'
  const rl = (r) => r || t('territory.dashboard.unspecified')
  const cap = (v) => (typeof v === 'number' ? nf.format(v) : '—')
  const none = <p className="territory-muted">{t('territory.dashboard.noData')}</p>
  const topCust = stats.topCustomers

  return (
    <div className="territory-page">
      <div className="territory-head"><h2>{t('territory.nav.reports')}</h2></div>
      <FilterPanel value={filters} onChange={setFilters} regions={regions} customers={customers} />
      <p className="territory-count">{t('territory.farms.count', { count: scoped.length })}</p>

      <Section title={t(`${R}.byRegion`)} exportProps={{
        name: t(`${R}.byRegion`), file: 'farms-by-region',
        headers: [t(`${R}.col.region`), t(`${R}.col.farms`), t(`${R}.col.capacity`)],
        rows: stats.byRegion.map((r) => [rl(r.region), r.farms, r.capacity]),
      }}>
        {stats.byRegion.length === 0 ? none : (
          <>
            <BarChart data={stats.byRegion.map((r) => ({ label: rl(r.region), value: r.capacity }))}
              format={cap} ariaLabel={t(`${R}.chartLabel`)} />
            <div className="import-scroll">
              <table className="import-table">
                <thead><tr><th>{t(`${R}.col.region`)}</th><th>{t(`${R}.col.farms`)}</th><th>{t(`${R}.col.capacity`)}</th></tr></thead>
                <tbody>{stats.byRegion.map((r) => (
                  <tr key={r.region}><td dir="auto">{rl(r.region)}</td><td>{nf.format(r.farms)}</td><td>{cap(r.capacity)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </>
        )}
      </Section>

      <Section title={t(`${R}.topFarms`)} exportProps={{
        name: t(`${R}.topFarms`), file: 'top-farms',
        headers: [t(`${R}.col.farm`), t(`${R}.col.region`), t(`${R}.col.capacity`)],
        rows: stats.topFarms.map((f) => [f.name, f.region || customersById[f.customerId]?.region || '', f.capacity]),
      }}>
        {stats.topFarms.length === 0 ? none : (
          <ol className="territory-list list-flat rank-list">{stats.topFarms.map((f, i) => (
            <li key={f.id}><Link to={`/farms/${f.id}`} className="territory-row"><span className="rank">{i + 1}</span><span className="territory-row-main"><strong dir="auto">{f.name}</strong></span><span className="row-num">{nf.format(f.capacity)}</span></Link></li>
          ))}</ol>
        )}
      </Section>

      <Section title={t(`${R}.topCustomers`)} exportProps={{
        name: t(`${R}.topCustomers`), file: 'top-customers',
        headers: [t(`${R}.col.customer`), t(`${R}.col.farms`), t(`${R}.col.capacity`), t(`${R}.col.unknown`)],
        rows: topCust.map((c) => [customerLabel(c.customer, customers), c.farms, c.capacity, c.unknown]),
      }}>
        {topCust.length === 0 ? none : (
          <ol className="territory-list list-flat rank-list">{topCust.map(({ customer, farms: n, capacity }, i) => (
            <li key={customer.id}><Link to={`/customers/${customer.id}`} className="territory-row">
              <span className="rank">{i + 1}</span>
              <span className="territory-row-main"><strong dir="auto">{customerLabel(customer, customers)}</strong>
                <span className="territory-muted">{t(`${R}.farmCount`, { count: n })}</span></span>
              <span className="row-num">{nf.format(capacity)}</span>
            </Link></li>
          ))}</ol>
        )}
      </Section>

      <Section title={t(`${R}.prospects`)} exportProps={{
        name: t(`${R}.prospects`), file: 'prospects-near-customers',
        headers: [t(`${R}.col.farm`), t(`${R}.col.status`), t(`${R}.col.nearest`), t(`${R}.col.distance`), t(`${R}.col.capacity`)],
        rows: prospects.map((p) => [p.farm.name, t(`territory.farms.status.${p.farm.status}`), p.nearest.name, Math.round(p.distanceKm * 10) / 10, p.farm.capacity ?? null]),
      }}>
        {prospects.length === 0 ? <p className="territory-muted">{t(`${R}.noProspects`)}</p> : (
          <ul className="territory-list list-flat">{prospects.map((p) => (
            <li key={p.farm.id}><Link to={`/farms/${p.farm.id}`} className={`territory-row row-${p.farm.status}`}>
              <span className="territory-row-main"><strong dir="auto">{p.farm.name}</strong>
                <span className="territory-muted">{t(`territory.farms.status.${p.farm.status}`)} · {t(`${R}.nearestFarm`, { name: p.nearest.name })}</span></span>
              <span className="territory-row-side"><span className="row-num">{t(`${R}.km`, { km: nf1.format(p.distanceKm) })}</span><span className="territory-muted">{cap(p.farm.capacity)}</span></span>
            </Link></li>
          ))}</ul>
        )}
      </Section>
    </div>
  )
}
