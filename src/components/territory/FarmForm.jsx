import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { saveFarm } from '../../territory/store'
import { useTerritory } from '../../territory/useTerritory'
import { parseNumberLoose } from '../../territory/normalize'
import { findDuplicateFarms, findSameNameFarm, formToFarm, locationInputError } from '../../territory/farmForm'
import { customerOptionLabel } from '../../territory/customerLabel'
import LocationInput from './LocationInput'
import { hasCoords } from '../../territory/geo'

const STATUSES = ['customer', 'prospect', 'competitor']
const str = (v) => (v === null || v === undefined ? '' : String(v))

export default function FarmForm({ initial = {}, onSaved, onCancel }) {
  const { t } = useTranslation()
  const { customers, farms } = useTerritory()
  const [v, setV] = useState({
    id: initial.id,
    name: str(initial.name),
    status: initial.status || (initial.customerId ? 'customer' : 'prospect'),
    customerId: initial.customerId || '',
    ownerName: str(initial.ownerName),
    capacity: str(initial.capacity),
    region: str(initial.region),
    address: str(initial.address),
    notes: str(initial.notes),
    lat: str(initial.lat),
    lng: str(initial.lng),
    locationSource: initial.locationSource || null,
    locationAccuracy: typeof initial.locationAccuracy === 'number' ? initial.locationAccuracy : null,
    verify: initial.locationStatus === 'verify',
  })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pastePending, setPastePending] = useState(false)

  // An error goes away as soon as the user changes the field it is about.
  const clearError = (k) => setErrors((cur) => (cur[k] ? { ...cur, [k]: undefined } : cur))
  const set = (k) => (e) => {
    clearError(k)
    setV((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  }
  const sortedCustomers = useMemo(() => [...customers].sort((a, b) => a.name.localeCompare(b.name)), [customers])

  const lat = parseNumberLoose(v.lat)
  const lng = parseNumberLoose(v.lng)
  const located = lat !== null && lng !== null
  const duplicates = useMemo(() => (
    located && (v.locationSource === 'typed' || v.locationSource === 'map')
      ? findDuplicateFarms({ lat, lng }, farms, { excludeId: v.id })
      : []
  ), [located, lat, lng, v.locationSource, v.id, farms])

  const sameName = useMemo(() => findSameNameFarm(v, farms), [v.id, v.name, v.status, v.customerId, v.ownerName, farms]) // eslint-disable-line react-hooks/exhaustive-deps

  const contextPoints = useMemo(() => {
    const own = v.customerId ? farms.filter((f) => f.customerId === v.customerId) : []
    return own.filter(hasCoords).map((f) => ({ lat: f.lat, lng: f.lng }))
  }, [farms, v.customerId])

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    setErrors({}); setFormError('')
    if (!v.name.trim()) { setErrors({ name: t('territory.farms.form.nameRequired') }); return }
    if (v.status === 'customer' && !v.customerId) { setErrors({ customerId: t('territory.farms.form.customerRequired') }); return }
    if (sameName) { setErrors({ name: t('territory.farms.form.nameTaken', { name: sameName.name }) }); return }
    if (pastePending) { setErrors({ location: t('territory.location.err.pasteBlocking') }); return }
    const locErr = locationInputError(v.lat, v.lng)
    if (locErr) { setErrors({ location: t(`territory.location.err.${locErr}`) }); return }
    setBusy(true)
    try {
      const saved = await saveFarm(formToFarm(v))
      onSaved(saved)
    } catch (err) {
      console.error(err)
      if (err.field && ['name', 'customerId', 'location', 'status', 'locationSource'].includes(err.field)) {
        setErrors({ [err.field]: t(`territory.farms.form.error.${err.field}`) })
      } else {
        setFormError(t('territory.farms.form.saveFailed'))
      }
      setBusy(false)
    }
  }

  return (
    <form className="territory-form" onSubmit={submit} noValidate>
      <label>{t('territory.farms.form.name')} *
        <input value={v.name} onChange={set('name')} autoComplete="off" required />
      </label>
      {errors.name && !sameName && <p className="form-error" role="alert">{errors.name}</p>}
      {sameName && <p className="form-error" role="alert">{t('territory.farms.form.nameTaken', { name: sameName.name })}</p>}

      <label>{t('territory.farms.form.status')}
        <select value={v.status} onChange={set('status')}>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`territory.farms.status.${s}`)}</option>)}
        </select>
      </label>
      {errors.status && <p className="form-error" role="alert">{errors.status}</p>}

      {v.status === 'customer' ? (
        <>
          <label>{t('territory.farms.form.customer')} *
            <select value={v.customerId} onChange={set('customerId')}>
              <option value="">{t('territory.farms.form.chooseCustomer')}</option>
              {sortedCustomers.map((c) => <option key={c.id} value={c.id}>{customerOptionLabel(c)}</option>)}
            </select>
          </label>
          {errors.customerId && <p className="form-error" role="alert">{errors.customerId}</p>}
        </>
      ) : (
        <label>{t('territory.farms.form.ownerName')}
          <input value={v.ownerName} onChange={set('ownerName')} autoComplete="off" />
        </label>
      )}

      <label>{t('territory.farms.form.capacity')}
        <input type="text" inputMode="numeric" value={v.capacity} onChange={set('capacity')} />
      </label>
      <label>{t('territory.farms.form.region')}
        <input value={v.region} onChange={set('region')} />
      </label>
      <label>{t('territory.farms.form.address')}
        <textarea rows={2} value={v.address} onChange={set('address')} />
      </label>
      <label>{t('territory.farms.form.notes')}
        <textarea rows={3} value={v.notes} onChange={set('notes')} />
      </label>

      <LocationInput
        value={v}
        contextPoints={contextPoints}
        onPastePendingChange={(p) => { setPastePending(p); if (!p) clearError('location') }}
        onChange={(next) => { clearError('location'); clearError('locationSource'); setV((s) => ({ ...s, lat: next.lat, lng: next.lng, locationSource: next.locationSource, locationAccuracy: next.locationAccuracy, verify: next.lat || next.lng ? s.verify : false })) }}
      />
      {errors.location && <p className="form-error" role="alert">{errors.location}</p>}
      {errors.locationSource && <p className="form-error" role="alert">{errors.locationSource}</p>}

      {duplicates.length > 0 && (
        <div className="territory-warning" role="status">
          <p><strong>{t('territory.farms.form.possibleDuplicate')}</strong></p>
          <ul>
            {duplicates.map((d) => (
              <li key={d.farm.id}>{t('territory.farms.form.duplicateItem', { name: d.farm.name, m: d.distanceM })}</li>
            ))}
          </ul>
        </div>
      )}

      {located && (
        <label className="territory-check">
          <input type="checkbox" checked={v.verify} onChange={set('verify')} />
          {t('territory.farms.form.needsVerification')}
        </label>
      )}

      {formError && <p className="form-error" role="alert">{formError}</p>}
      <div className="territory-actions form-actions-bar">
        <button type="submit" className="btn-primary" disabled={busy}>{t('territory.farms.form.save')}</button>
        <button type="button" className="territory-btn" onClick={onCancel}>{t('territory.farms.form.cancel')}</button>
      </div>
    </form>
  )
}
