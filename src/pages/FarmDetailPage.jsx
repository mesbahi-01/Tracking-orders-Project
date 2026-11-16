import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getFarm, getCustomer, deleteFarm } from '../territory/store'
import { mapsLinks, hasCoords } from '../territory/geo'
import { customerLabel } from '../territory/customerLabel'
import { useTerritory } from '../territory/useTerritory'
import { StatusBadge } from '../components/territory/ui'
import { IconNearby, IconDirections, IconExternal, IconEdit, IconTrash, IconWarning, IconPin, IconFarm } from '../components/territory/icons'

export default function FarmDetailPage() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { reload, customers } = useTerritory()
  const [farm, setFarm] = useState(undefined)
  const [customer, setCustomer] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const nf = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language])

  useEffect(() => {
    let active = true
    setFarm(undefined); setConfirming(false); setError('')
    ;(async () => {
      const f = await getFarm(id)
      const c = f?.customerId ? await getCustomer(f.customerId) : null
      if (active) { setCustomer(c || null); setFarm(f || null) }
    })().catch((e) => { console.error(e); if (active) setFarm(null) })
    return () => { active = false }
  }, [id])

  if (farm === undefined) return <p className="territory-muted">{t('loading')}</p>
  if (farm === null) {
    return (
      <div className="territory-page">
        <div className="surface-card empty-state">
          <span className="empty-state-icon"><IconWarning size={28} /></span>
          <p className="empty-state-title">{t('territory.farms.notFound')}</p>
          <Link className="territory-btn" to="/farms">{t('territory.farms.backToList')}</Link>
        </div>
      </div>
    )
  }

  const hasLoc = hasCoords(farm)
  const links = hasLoc ? mapsLinks(farm) : null
  const locStatus = farm.locationStatus || 'missing'

  async function doDelete() {
    if (busy) return
    setBusy(true); setError('')
    try {
      await deleteFarm(id)
      await reload()
      navigate('/farms')
    } catch (e) {
      console.error(e)
      setError(t('territory.farms.deleteFailed'))
      setBusy(false)
    }
  }

  return (
    <div className="territory-page">
      <section className={`surface-card hero-card row-${farm.status}`}>
        <h2 dir="auto">{farm.name}</h2>
        <div className="badge-row">
          <StatusBadge status={farm.status} />
          <span className={`territory-badge badge-${locStatus}`}>{t(`territory.farms.location.${locStatus}`)}</span>
        </div>
        <div className="hero-kpi">
          <span className="kpi-value">{typeof farm.capacity === 'number' ? nf.format(farm.capacity) : t('territory.farms.capacityUnknown')}</span>
          <span className="kpi-label">{t('territory.farms.form.capacity')}</span>
        </div>
      </section>

      <div className="action-grid">
        {links && <a className="action-tile is-primary" href={links.directions} target="_blank" rel="noopener noreferrer"><IconDirections size={22} /><span>{t('territory.farms.directions')}</span></a>}
        {hasLoc && <Link className="action-tile" to={`/nearby?farm=${farm.id}`}><IconNearby size={22} /><span>{t('territory.farms.nearby')}</span></Link>}
        {links && <a className="action-tile" href={links.view} target="_blank" rel="noopener noreferrer" aria-label={t('territory.farms.openMaps')}><IconExternal size={22} /><span>{t('territory.farms.googleMaps')}</span></a>}
        <Link className={`action-tile${links ? '' : ' is-primary'}`} to={`/farms/${farm.id}/edit`}><IconEdit size={22} /><span>{t('territory.farms.edit')}</span></Link>
      </div>

      <section className="surface-card">
        <h3><IconFarm size={18} className="h-icon" />{t('territory.farms.details')}</h3>
        <dl className="territory-facts">
          <dt>{farm.customerId ? t('territory.farms.form.customer') : t('territory.farms.form.ownerName')}</dt>
          <dd>
            {farm.customerId
              ? (customer ? <Link to={`/customers/${customer.id}`}>{customerLabel(customer, customers)}</Link> : '—')
              : (farm.ownerName || '—')}
          </dd>
          <dt>{t('territory.farms.form.region')}</dt><dd>{farm.region || '—'}</dd>
          <dt>{t('territory.farms.form.address')}</dt><dd>{farm.address || '—'}</dd>
          <dt>{t('territory.farms.form.notes')}</dt><dd>{farm.notes || '—'}</dd>
        </dl>
      </section>

      <section className="surface-card">
        <h3><IconPin size={18} className="h-icon" />{t('territory.location.title')}</h3>
        <dl className="territory-facts">
          <dt>{t('territory.location.coordinates')}</dt>
          <dd className="num">{hasLoc ? `${farm.lat.toFixed(6)}, ${farm.lng.toFixed(6)}` : t('territory.farms.location.missing')}</dd>
          <dt>{t('territory.farms.locationSource')}</dt>
          <dd>
            {farm.locationSource ? t(`territory.farms.source.${farm.locationSource}`) : '—'}
            {typeof farm.locationAccuracy === 'number' && ` (±${Math.round(farm.locationAccuracy)} m)`}
          </dd>
        </dl>
      </section>

      {confirming ? (
        <div className="territory-warning" role="alertdialog" aria-label={t('territory.farms.deleteTitle')}>
          <p><strong>{t('territory.farms.deleteTitle')}</strong></p>
          <div className="territory-actions">
            <button type="button" className="btn-danger" disabled={busy} onClick={doDelete}>{t('territory.farms.delete')}</button>
            <button type="button" className="territory-btn" disabled={busy} onClick={() => setConfirming(false)}>{t('territory.farms.form.cancel')}</button>
          </div>
        </div>
      ) : (
        <button type="button" className="territory-btn btn-danger-ghost" onClick={() => setConfirming(true)}><IconTrash size={18} />{t('territory.farms.delete')}</button>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  )
}
