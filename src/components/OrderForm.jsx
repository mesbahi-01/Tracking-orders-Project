import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
  const [items, setItems] = useState([])
  const [product, setProduct] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('Ton')

  useEffect(() => {
    if (editing) {
      setClient(editing.client || '')
      setDesiredDate(editing.desiredDate ? editing.desiredDate.split('T')[0] : '')
      setItems(editing.items || [])
      setProduct('')
      setQuantity('')
      setUnit('KG')
    }
  }, [editing])

  function reset() {
    setClient('')
    setDesiredDate(getDefaultDesiredDate())
    setItems([])
    setProduct('')
    setQuantity('')
    setUnit('Ton')
  }

  function addItem() {
    if (!product.trim()) {
      alert(t('form.pleaseEnterProduct'))
      return
    }
    if (!quantity || quantity <= 0) {
      alert(t('form.pleaseEnterQuantity'))
      return
    }
    const newItem = { product, quantity: parseFloat(quantity), unit }
    setItems([...items, newItem])
    setProduct('')
    setQuantity('')
    setUnit('KG')
  }

  function removeItem(index) {
    setItems(items.filter((_, i) => i !== index))
  }

  async function submit(e) {
    e.preventDefault()
    if (!client.trim()) {
      alert(t('form.pleaseEnterClient'))
      return
    }
    if (items.length === 0) {
      alert(t('form.pleaseAddItem'))
      return
    }
    const payload = { client, desiredDate, items }
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
          <input value={client} onChange={e => setClient(e.target.value)} required />
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
        <h3>{t('form.items')}</h3>
        <div className="add-item">
          <label>
            {t('form.product')}
            <input value={product} onChange={e => setProduct(e.target.value)} placeholder="Product name" />
          </label>
          <label>
            {t('form.quantity')}
            <input type="number" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" />
          </label>
          <label>
            {t('form.unit')}
            <select value={unit} onChange={e => setUnit(e.target.value)}>
              <option>KG</option>
              <option>Ton</option>
            </select>
          </label>
          <button type="button" className="secondary" onClick={addItem}>
            {t('form.addItem')}
          </button>
        </div>

        {items.length > 0 && (
          <div className="items-list">
            {items.map((item, idx) => (
              <div key={idx} className="item-row">
                <span className="item-product">{item.product}</span>
                <span className="item-quantity">{item.quantity} {item.unit}</span>
                <button
                  type="button"
                  className="danger-small"
                  onClick={() => removeItem(idx)}
                >
                  {t('form.remove')}
                </button>
              </div>
            ))}
          </div>
        )}
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
