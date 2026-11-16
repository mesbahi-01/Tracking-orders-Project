import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getClientNames } from '../clients'
import { ensureCustomerId } from '../territory/customerLink'
import { normalizeName } from '../territory/normalize'
import CustomerPicker from './territory/CustomerPicker'

export default function OrderForm({ onAdd, editing, onEdit, cancelEdit }) {
  const { t } = useTranslation()
  const [client, setClient] = useState('')

  // default desired date = tomorrow (yyyy-mm-dd)
  function getDefaultDesiredDate() {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  }

  const [desiredDate, setDesiredDate] = useState(getDefaultDesiredDate())
  const [orderDetails, setOrderDetails] = useState('')
  const [clients, setClients] = useState([])
  const [picker, setPicker] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (editing) {
      setClient(editing.client || '')
      setDesiredDate(editing.desiredDate ? editing.desiredDate.split('T')[0] : '')
      if (editing.orderDetails) {
        setOrderDetails(editing.orderDetails)
      } else if (editing.items && editing.items.length > 0) {
        const details = editing.items.map(item => `${item.product} (${item.quantity} ${item.unit})`).join(', ');
        setOrderDetails(details);
      } else {
        setOrderDetails('')
      }
    }
  }, [editing])

  function refreshClients() {
    getClientNames().then(setClients).catch(err => console.error('Failed to load clients', err))
  }

  useEffect(() => {
    refreshClients()
  }, []);

  // resolves with a customer, null (new customer) or undefined (cancelled)
  function askPicker(customers) {
    return new Promise(resolve => setPicker({ customers, resolve }))
  }

  function closePicker(result) {
    if (picker) picker.resolve(result)
    setPicker(null)
  }

  function reset() {
    setClient('')
    setDesiredDate(getDefaultDesiredDate())
    setOrderDetails('')
  }

  async function submit(e) {
    e.preventDefault()
    const trimmedClient = client.trim()
    if (!trimmedClient) {
      alert(t('form.pleaseEnterClient'))
      return
    }
    if (!orderDetails.trim()) {
      alert(t('form.pleaseEnterOrderDetails'))
      return
    }
    if (submitting) return

    setSubmitting(true)
    try {
      let customerId
      if (editing && editing.customerId && normalizeName(editing.client || '') === normalizeName(trimmedClient)) {
        // same name as before: keep the existing link
        customerId = editing.customerId
      } else {
        customerId = await ensureCustomerId(trimmedClient, askPicker)
        if (!customerId) return // picker cancelled
      }

      const payload = { client: trimmedClient, desiredDate, orderDetails, customerId }
      if (editing) {
        await onEdit(editing.id, payload)
      } else {
        await onAdd(payload)
      }
      reset()
      refreshClients()
    } catch (err) {
      console.error('Failed to save order', err)
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="order-form" onSubmit={submit}>
      <div className="row">
        <label>
          {t('form.client')}
          <input
            list="client-list"
            value={client}
            onChange={e => setClient(e.target.value)}
            required
            placeholder={t('form.clientPlaceholder')}
          />
          <datalist id="client-list">
            {clients
              .filter(c => c.toLowerCase().includes(client.toLowerCase()))
              .map((c, i) => (
              <option key={i} value={c} />
            ))}
          </datalist>
        </label>
        <label>
          {t('form.desiredDate')}
          <input
            type="date"
            value={desiredDate}
            onChange={e => setDesiredDate(e.target.value)}
            title={desiredDate ? desiredDate.replace(/-/g, '/') : ''}
          />
        </label>
      </div>

      <div className="items-section">
        <label>
          {t('form.orderDetails')}
          <input type="text" value={orderDetails} onChange={e => setOrderDetails(e.target.value)} placeholder={t('form.orderDetailsPlaceholder')} />
        </label>
      </div>

      <div className="actions">
        <button type="submit" disabled={submitting}>{editing ? t('form.save') : t('form.addOrder')}</button>
        {editing && (
          <button type="button" className="secondary" onClick={() => { cancelEdit(); reset(); }}>
            {t('form.cancel')}
          </button>
        )}
      </div>

      {picker && (
        <CustomerPicker
          customers={picker.customers}
          title={t('customerPicker.title')}
          onPick={closePicker}
          onCancel={() => closePicker(undefined)}
        />
      )}
    </form>
  )
}
