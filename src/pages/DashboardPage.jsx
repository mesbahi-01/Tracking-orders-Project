import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTerritory } from '../territory/useTerritory'
import { computeStats } from '../territory/stats'
import { getSetting } from '../territory/store'
import { backupAgeDays } from '../territory/backupStatus'
import { customerLabel } from '../territory/customerLabel'
import BarChart from '../components/territory/BarChart'
import { IconCustomers, IconFarm, IconCapacity, IconReports, IconPin, IconShield, IconChevronRight } from '../components/territory/icons'

export default function DashboardPage() {
  const { t, i18n } = useTranslation()
  const { farms, customers, loading } = useTerritory()
  const nf = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language])
  const stats = useMemo(() => computeStats(customers, farms), [customers, farms])
  const [backupAt, setBackupAt] = useState(undefined)

  useEffect(() => {
    let alive = true
    getSetting('lastBackupAt').then((v) => alive && setBackupAt(v ?? null)).catch(() => alive && setBackupAt(null))
    return () => { alive = false }
  }, [])

  if (loading) return <p className="territory-muted">{t('loading')}</p>

  const age = backupAt ? backupAgeDays(backupAt) : null
  const backupOverdue = backupAt === null || (backupAt && (age === null || age > 7))
  let backupText = '…'
  if (backupAt === null || (backupAt && age === null)) backupText = t('territory.dashboard.neverBackedUp')
  else if (age !== null) backupText = age === 0 ? t('territory.dashboard.today') : t('territory.dashboard.daysAgo', { count: age })

  const regionLabel = (r) => r || t('territory.dashboard.unspecified')
  const regionData = stats.byRegion.map((r) => ({ label: regionLabel(r.region), value: r.farms }))
  const s = stats.farmsByStatus
  const breakdown = ['customer', 'prospect', 'competitor'].map((k) => `${nf.format(s[k])} ${t(`territory.farms.status.${k}`)}`).join(' · ')

  return (
    <div className="territory-page">
      <div className="territory-head"><h2>{t('territory.nav.dashboard')}</h2></div>

      <div className="stat-tiles">
        <Tile icon={<IconCustomers />} label={t('territory.dashboard.customers')} value={nf.format(stats.customerCount)} to="/customers" />
        <Tile icon={<IconFarm />} label={t('territory.dashboard.farms')} value={nf.format(stats.farmCount)} note={breakdown} to="/farms" />
        <Tile icon={<IconCapacity />} label={t('territory.dashboard.totalCapacity')} value={nf.format(stats.totalCapacity)}
          note={stats.unknownCapacityCount > 0 ? t('territory.dashboard.unknownCapacity', { count: stats.unknownCapacityCount }) : null} />
        <Tile icon={<IconReports />} label={t('territory.dashboard.avgCapacity')} value={stats.avgCapacity === null ? '—' : nf.format(stats.avgCapacity)} />
        <Tile icon={<IconPin />} label={t('territory.farms.needsLocation')} value={nf.format(stats.needsLocation)} to="/farms?ls=missing,verify"
          tone={stats.needsLocation > 0 ? 'warn' : null} />
        <Tile icon={<IconShield />} label={t('territory.dashboard.lastBackup')} value={backupText} small to="/data" tone={backupOverdue ? 'warn' : null} />
      </div>

      <section className="territory-section surface-card">
        <h3>{t('territory.dashboard.farmsByRegion')}</h3>
        {regionData.length === 0 ? <p className="territory-muted">{t('territory.dashboard.noData')}</p> : <BarChart data={regionData} format={nf.format} />}
      </section>

      <section className="territory-section surface-card">
        <h3>{t('territory.dashboard.topFarms')}</h3>
        {stats.topFarms.length === 0 ? <p className="territory-muted">{t('territory.dashboard.noData')}</p> : (
          <ol className="territory-list list-flat rank-list">
            {stats.topFarms.slice(0, 5).map((f, i) => (
              <li key={f.id}><Link to={`/farms/${f.id}`} className="territory-row">
                <span className="rank">{i + 1}</span>
                <span className="territory-row-main"><strong dir="auto">{f.name}</strong></span>
                <span className="row-num">{nf.format(f.capacity)}</span>
              </Link></li>
            ))}
          </ol>
        )}
      </section>

      <section className="territory-section surface-card">
        <h3>{t('territory.dashboard.topCustomers')}</h3>
        {stats.topCustomers.length === 0 ? <p className="territory-muted">{t('territory.dashboard.noData')}</p> : (
          <ol className="territory-list list-flat rank-list">
            {stats.topCustomers.slice(0, 5).map(({ customer, capacity }, i) => (
              <li key={customer.id}><Link to={`/customers/${customer.id}`} className="territory-row">
                <span className="rank">{i + 1}</span>
                <span className="territory-row-main"><strong dir="auto">{customerLabel(customer, customers)}</strong></span>
                <span className="row-num">{nf.format(capacity)}</span>
              </Link></li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

// Same-name customers get phone/region so they can be told apart.
function Tile({ icon, label, value, note, to, small, tone }) {
  const body = (
    <>
      <span className="stat-top">
        <span className="stat-icon" aria-hidden="true">{icon && React.cloneElement(icon, { size: 18 })}</span>
        {to && <IconChevronRight size={16} className="stat-go" />}
      </span>
      <span className={`stat-value${small ? ' stat-value-sm' : ''}`}>{value}</span>
      <span className="stat-label">{label}</span>
      {note && <span className="stat-note">{note}</span>}
    </>
  )
  const cls = `stat-tile${tone ? ` is-${tone}` : ''}`
  return to ? <Link to={to} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}
