import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { saveCustomer, findCustomersByName, listFarmsByCustomer } from '../../territory/store'
import { normalizeName } from '../../territory/normalize'
import { renameCustomer } from '../../territory/customerLink'

const FIELDS = ['phone', 'email', 'region', 'address', 'notes']

export default function CustomerForm({ customer, regions, onSaved, onCancel }) {
  const { t } = useTranslation()
  const [values, setValues] = useState({
    name: customer?.name || '', phone: customer?.phone || '', email: customer?.email || '',
    region: customer?.region || '', address: customer?.address || '', notes: customer?.notes || '',
  })
  const [error, setError] = useState('')
  const [duplicates, setDuplicates] = useState(null)
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => {
    setValues((v) => ({ ...v, [k]: e.target.value }))
    setDuplicates(null)
  }

  async function persist() {
    const rest = { phone: values.phone, email: values.email, region: values.region, address: values.address, notes: values.notes }
    let saved
    if (customer) {
      const nameChanged = values.name.trim() !== customer.name
      saved = await saveCustomer({ id: customer.id, ...rest })
      if (nameChanged) saved = await renameCustomer(customer.id, values.name)
    } else {
      saved = await saveCustomer({ name: values.name, ...rest })
    }
    return saved
  }

  async function submit(e, force = false) {
    e?.preventDefault()
    if (busy) return
    setError('')
    if (!values.name.trim()) { setError(t('territory.customers.form.nameRequired')); return }
    setBusy(true)
    let saved
    try {
      const nameChanged = !customer || normalizeName(values.name) !== customer.nameKey
      if (!force && nameChanged) {
        const matches = (await findCustomersByName(values.name)).filter((c) => c.id !== customer?.id)
        if (matches.length) {
          const withCounts = await Promise.all(matches.map(async (c) => ({ ...c, farmCount: (await listFarmsByCustomer(c.id)).length })))
          setDuplicates(withCounts)
          setBusy(false)
          return
        }
      }
      saved = await persist()
    } catch (err) {
      console.error(err)
      setError(err.field === 'name' ? t('territory.customers.form.nameRequired') : t('territory.customers.form.saveFailed'))
      setBusy(false)
      return
    }
    onSaved(saved)
  }

  return (
    <form className="territory-form" onSubmit={submit} noValidate>
      <label>{t('territory.customers.form.name')} *
        <input value={values.name} onChange={set('name')} autoComplete="off" required />
      </label>
      {FIELDS.map((f) => (
        <label key={f}>{t(`territory.customers.form.${f}`)}
          {f === 'notes' || f === 'address' ? (
            <textarea rows={f === 'notes' ? 3 : 2} value={values[f]} onChange={set(f)} />
          ) : (
            <input
              value={values[f]} onChange={set(f)}
              type={f === 'phone' ? 'tel' : f === 'email' ? 'email' : 'text'}
              list={f === 'region' ? 'customer-regions' : undefined}
            />
          )}
        </label>
      ))}
      <datalist id="customer-regions">{regions.map((r) => <option key={r} value={r} />)}</datalist>

      {error && <p className="form-error" role="alert">{error}</p>}

      {duplicates && (
        <div className="territory-warning" role="alert">
          <p><strong>{t('territory.customers.form.nameExists')}</strong></p>
          <ul>
            {duplicates.map((c) => (
              <li key={c.id}>
                {c.name} · {c.phone || '—'} · {c.region || '—'} · {t('territory.customers.farmCount', { count: c.farmCount })}
              </li>
            ))}
          </ul>
          <p>{customer ? t('territory.customers.form.renameAnyway') : t('territory.customers.form.createAnyway')}</p>
          <div className="territory-actions">
            <button type="button" className="btn-primary" disabled={busy} onClick={(e) => submit(e, true)}>
              {t('territory.customers.form.yes')}
            </button>
            <button type="button" className="territory-btn" onClick={() => setDuplicates(null)}>{t('territory.customers.form.no')}</button>
          </div>
        </div>
      )}

      {!duplicates && (
        <div className="territory-actions form-actions-bar">
          <button type="submit" className="btn-primary" disabled={busy}>{t('territory.customers.form.save')}</button>
          <button type="button" className="territory-btn" onClick={onCancel}>{t('territory.customers.form.cancel')}</button>
        </div>
      )}
    </form>
  )
}
