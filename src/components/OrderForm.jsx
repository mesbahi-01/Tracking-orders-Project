import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getClients, addClient as addClientToStorage } from '../clients'

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

  useEffect(() => {
    setClients(getClients());
  }, []);

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

    // Add client if new
    const existingClient = clients.find(c => c.toLowerCase() === trimmedClient.toLowerCase());
    if (!existingClient) {
      const updatedClients = addClientToStorage(trimmedClient, clients);
      setClients(updatedClients);
    }

    const payload = { client: trimmedClient, desiredDate, orderDetails }
    if (editing) {
      await onEdit(editing.id, payload)
    } else {
      await onAdd(payload)
    }
    reset()
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
        <button type="submit">{editing ? t('form.save') : t('form.addOrder')}</button>
        {editing && (
          <button type="button" className="secondary" onClick={() => { cancelEdit(); reset(); }}>
            {t('form.cancel')}
          </button>
        )}
      </div>
    </form>
  )
}
