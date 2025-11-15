import React, { useEffect, useState } from 'react'

export default function OrderForm({ onAdd, editing, onEdit, cancelEdit }) {
  const [client, setClient] = useState('')
  const [desiredDate, setDesiredDate] = useState(new Date().toISOString().split('T')[0])
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
    setDesiredDate(new Date().toISOString().split('T')[0])
    setItems([])
    setProduct('')
    setQuantity('')
    setUnit('Ton')
  }

  function addItem() {
    if (!product.trim()) {
      alert('Please enter a product name')
      return
    }
    if (!quantity || quantity <= 0) {
      alert('Please enter a valid quantity')
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
      alert('Please enter a client name')
      return
    }
    if (items.length === 0) {
      alert('Please add at least one item')
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
          Client
          <input value={client} onChange={e => setClient(e.target.value)} required />
        </label>
        <label>
          Desired date (yyyy/mm/dd)
          <input 
            type="date" 
            value={desiredDate} 
            onChange={e => setDesiredDate(e.target.value)}
            title={desiredDate ? desiredDate.replace(/-/g, '/') : ''}
          />
        </label>
      </div>

      <div className="items-section">
        <h3>Items</h3>
        <div className="add-item">
          <label>
            Product
            <input value={product} onChange={e => setProduct(e.target.value)} placeholder="Product name" />
          </label>
          <label>
            Quantity
            <input type="number" step="0.01" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" />
          </label>
          <label>
            Unit
            <select value={unit} onChange={e => setUnit(e.target.value)}>
              <option>KG</option>
              <option>Ton</option>
            </select>
          </label>
          <button type="button" className="secondary" onClick={addItem}>
            Add Item
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
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="actions">
        <button type="submit">{editing ? 'Save' : 'Add order'}</button>
        {editing && (
          <button type="button" className="secondary" onClick={() => { cancelEdit(); reset(); }}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
