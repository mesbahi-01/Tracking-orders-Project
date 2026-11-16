import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getCustomer, listFarmsByCustomer } from '../territory/store'
import { customerUsage, deleteCustomer } from '../territory/customerLink'
import { customerTotals } from '../territory/customerStats'
import { getAllOrders } from '../db'
import { useTerritory } from '../territory/useTerritory'
import FarmMap from '../components/territory/FarmMap'
import { hasCoords } from '../territory/geo'
import { IconPhone, IconPlus, IconEdit, IconUser, IconFarm, IconOrders, IconTrash, IconWarning } from '../components/territory/icons'

export default function CustomerProfilePage() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { reload } = useTerritory()
  const [customer, setCustomer] = useState(undefined)
  const [farms, setFarms] = useState([])
  const [orders, setOrders] = useState([])
  const [usage, setUsage] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const nf = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language])

  const load = useCallback(async () => {
    const c = await getCustomer(id)
    if (!c) { setCustomer(null); return }
    const [f, allOrders] = await Promise.all([listFarmsByCustomer(id), getAllOrders()])
    setFarms(f)
    setOrders(allOrders.filter((o) => o.customerId === id))
    setCustomer(c)
  }, [id])

  useEffect(() => {
    setCustomer(undefined)
    setConfirming(false)
    setBlocked(false)
    load().catch((e) => { console.error(e); setCustomer(null) })
  }, [load])

  if (customer === undefined) return <p className="territory-muted">{t('loading')}</p>
  if (customer === null) {
    return (
      <div className="territory-page">
        <div className="surface-card empty-state">
          <span className="empty-state-icon"><IconWarning size={28} /></span>
          <p className="empty-state-title">{t('territory.customers.notFound')}</p>
          <Link className="territory-btn" to="/customers">{t('territory.customers.backToList')}</Link>
        </div>
      </div>
    )
  }

  const totals = customerTotals(farms, id)

  async function onDeleteClick() {
    setDeleteError('')
    try {
      const u = await customerUsage(id)
      setUsage(u)
      if (u.orders > 0 || u.reports > 0) { setBlocked(true); setConfirming(false) } else { setBlocked(false); setConfirming(true) }
    } catch (e) {
      console.error(e)
      setDeleteError(t('territory.customers.deleteFailed'))
    }
  }

  async function doDelete(action) {
    if (busy) return
    setBusy(true)
    setDeleteError('')
    try {
      const res = await deleteCustomer(id, action)
      if (!res.ok) { await onDeleteClick(); setBusy(false); return }
      await reload()
      navigate('/customers')
    } catch (e) {
      console.error(e)
      setDeleteError(t('territory.customers.deleteFailed'))
      setBusy(false)
    }
  }

  return (
    <div className="territory-page">
      <section className="surface-card hero-card">
        <div className="hero-ident">
          <span className="avatar avatar-lg" aria-hidden="true">{(Array.from(customer.name.trim())[0] || '?').toUpperCase()}</span>
          <div className="hero-ident-text">
            <h2 dir="auto">{customer.name}</h2>
            {customer.region && <span className="territory-muted" dir="auto">{customer.region}</span>}
          </div>
        </div>
        <div className="hero-kpis">
          <div className="hero-kpi">
            <span className="kpi-value">{nf.format(totals.farmCount)}</span>
            <span className="kpi-label">{t('territory.customers.farms')}</span>
          </div>
          <div className="hero-kpi">
            <span className="kpi-value">{totals.known > 0 ? nf.format(totals.capacity) : '—'}</span>
            <span className="kpi-label">
              {t('territory.customers.totalCapacity')}
              {totals.unknown > 0 && <> · {t('territory.customers.unknown', { n: nf.format(totals.unknown) })}</>}
            </span>
          </div>
        </div>
      </section>

      <div className="action-grid">
        {customer.phone && <a className="action-tile is-primary" href={`tel:${customer.phone}`}><IconPhone size={22} /><span>{t('territory.customers.call')}</span></a>}
        <Link className="action-tile" to={`/farms/new?customer=${id}`}><IconPlus size={22} /><span>{t('territory.customers.addFarm')}</span></Link>
        <Link className={`action-tile${customer.phone ? '' : ' is-primary'}`} to={`/customers/${id}/edit`}><IconEdit size={22} /><span>{t('territory.customers.edit')}</span></Link>
      </div>

      <section className="surface-card">
        <h3><IconUser size={18} className="h-icon" />{t('territory.customers.contact')}</h3>
        <dl className="territory-facts">
          <dt>{t('territory.customers.form.phone')}</dt>
          <dd className="num">{customer.phone ? <a href={`tel:${customer.phone}`}>{customer.phone}</a> : '—'}</dd>
          <dt>{t('territory.customers.form.email')}</dt>
          <dd>{customer.email ? <a href={`mailto:${customer.email}`}>{customer.email}</a> : '—'}</dd>
          <dt>{t('territory.customers.form.region')}</dt><dd>{customer.region || '—'}</dd>
          <dt>{t('territory.customers.form.address')}</dt><dd>{customer.address || '—'}</dd>
          <dt>{t('territory.customers.form.notes')}</dt><dd>{customer.notes || '—'}</dd>
        </dl>
      </section>

      <section className="surface-card">
        <h3><IconFarm size={18} className="h-icon" />{t('territory.customers.farms')}</h3>
        {farms.some(hasCoords) && (
          <div className="embedded-map">
            <FarmMap farms={farms} customersById={{ [id]: customer }} height={240} onSelect={(f) => navigate(`/farms/${f.id}`)} />
          </div>
        )}
        {farms.length === 0 ? <p className="territory-muted">{t('territory.customers.noFarms')}</p> : (
          <ul className="territory-list list-flat">
            {farms.map((f) => (
              <li key={f.id}>
                <Link to={`/farms/${f.id}`} className={`territory-row row-${f.status}`}>
                  <span className="territory-row-main"><strong dir="auto">{f.name}</strong>
                    <span className="territory-muted">{t(`territory.farms.status.${f.status}`)}</span>
                  </span>
                  <span className="territory-row-side">
                    <span className="row-num">{typeof f.capacity === 'number' ? nf.format(f.capacity) : '—'}</span>
                    <span className={`territory-badge badge-${f.locationStatus || 'missing'}`}>
                      {t(`territory.customers.location.${f.locationStatus || 'missing'}`)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface-card">
        <h3><IconOrders size={18} className="h-icon" />{t('territory.customers.orders')}</h3>
        {orders.length === 0 ? <p className="territory-muted">{t('territory.customers.noOrders')}</p> : (
          <ul className="territory-list list-flat">
            {orders.map((o) => {
              const state = o.cancelled ? 'cancelled' : o.delivered ? 'delivered' : 'pending'
              return (
                <li key={o.id} className="territory-row">
                  <span className="territory-row-main">
                    <strong className="num">{o.desiredDate || '—'}</strong>
                    <span className="territory-muted">{o.orderDetails}</span>
                  </span>
                  <span className="territory-row-side">
                    <span className={`territory-badge badge-order-${state}`}>
                      {t(state === 'cancelled' ? 'territory.customers.orderCancelled' : state === 'delivered' ? 'territory.customers.orderDelivered' : 'territory.customers.orderPending')}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="danger-zone">
        {blocked && usage && (
          <p className="territory-warning" role="alert">
            {t('territory.customers.deleteBlocked', { orders: usage.orders, reports: usage.reports })}
          </p>
        )}
        {confirming && (
          <div className="territory-warning" role="alertdialog" aria-label={t('territory.customers.deleteTitle')}>
            <p><strong>{t('territory.customers.deleteTitle')}</strong></p>
            <p>{t('territory.customers.deleteBody', { count: farms.length })}</p>
            <div className="territory-actions">
              <button type="button" className="btn-danger" disabled={busy} onClick={() => doDelete('delete')}>{t('territory.customers.deleteFarms')}</button>
              <button type="button" className="territory-btn" disabled={busy} onClick={() => doDelete('prospect')}>{t('territory.customers.keepFarms')}</button>
              <button type="button" className="territory-btn" disabled={busy} onClick={() => setConfirming(false)}>{t('territory.customers.form.cancel')}</button>
            </div>
          </div>
        )}
        {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
        {!confirming && <button type="button" className="territory-btn btn-danger-ghost" onClick={onDeleteClick}><IconTrash size={18} />{t('territory.customers.delete')}</button>}
      </section>
    </div>
  )
}
