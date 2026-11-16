import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { mapsLinks, hasCoords } from '../../territory/geo'
import { customerLabel } from '../../territory/customerLabel'
import { StatusBadge } from './ui'
import { IconClose, IconNearby, IconEdit, IconUser, IconExternal, IconDirections } from './icons'

// customers: all customers, to tell a same-name customer apart (phone · region).
export default function FarmSheet({ farm, customer, customers = [], onClose }) {
  const { t, i18n } = useTranslation()
  const nf = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language])
  if (!farm) return null
  const ls = farm.locationStatus || 'missing'
  const located = hasCoords(farm)
  const links = located ? mapsLinks({ lat: farm.lat, lng: farm.lng }) : null
  const dash = '—'

  return (
    <aside className={`farm-sheet row-${farm.status}`} role="dialog" aria-label={farm.name}>
      <span className="sheet-handle" aria-hidden="true" />
      <div className="farm-sheet-head">
        <div className="farm-sheet-title">
          <h3 dir="auto">{farm.name}</h3>
          <div className="badge-row">
            <StatusBadge status={farm.status} />
            <span className={`territory-badge badge-${ls}`}>{t(`territory.farms.location.${ls}`)}</span>
          </div>
        </div>
        <button type="button" className="icon-btn farm-sheet-close" onClick={onClose} aria-label={t('territory.map.close')}><IconClose size={20} /></button>
      </div>
      <dl className="territory-facts">
        <dt>{t('territory.farms.form.customer')}</dt><dd>{customer ? customerLabel(customer, customers) : dash}</dd>
        <dt>{t('territory.farms.form.ownerName')}</dt><dd>{farm.ownerName || dash}</dd>
        <dt>{t('territory.farms.form.capacity')}</dt>
        <dd className="num">{typeof farm.capacity === 'number' ? nf.format(farm.capacity) : dash}</dd>
        <dt>{t('territory.farms.form.region')}</dt><dd>{farm.region || customer?.region || dash}</dd>
        <dt>{t('territory.farms.form.address')}</dt><dd>{farm.address || dash}</dd>
        <dt>{t('territory.farms.form.notes')}</dt><dd>{farm.notes || dash}</dd>
        <dt>{t('territory.location.title')}</dt>
        <dd>
          {t(`territory.farms.location.${ls}`)}
          {farm.locationSource && <span className="territory-muted"> · {t(`territory.farms.source.${farm.locationSource}`)}</span>}
        </dd>
      </dl>
      <div className="action-grid">
        {links && <a className="action-tile is-primary" href={links.directions} target="_blank" rel="noopener noreferrer"><IconDirections size={22} /><span>{t('territory.farms.directions')}</span></a>}
        <Link className="action-tile" to={`/nearby?farm=${farm.id}`}><IconNearby size={22} /><span>{t('territory.farms.nearby')}</span></Link>
        {customer && <Link className="action-tile" to={`/customers/${customer.id}`}><IconUser size={22} /><span>{t('territory.map.openCustomer')}</span></Link>}
        {links && <a className="action-tile" href={links.view} target="_blank" rel="noopener noreferrer" aria-label={t('territory.farms.openMaps')}><IconExternal size={22} /><span>{t('territory.farms.googleMaps')}</span></a>}
        <Link className="action-tile" to={`/farms/${farm.id}/edit`}><IconEdit size={22} /><span>{t('territory.farms.edit')}</span></Link>
      </div>
    </aside>
  )
}
