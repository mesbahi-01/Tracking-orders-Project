import React, { useEffect, useState } from 'react'
import OrderForm from './components/OrderForm'
import OrderList from './components/OrderList'
import { getOrdersSortedDesc, addOrder, updateOrder, toggleDelivered, searchOrders, getOrder, cancelOrder, deleteOrder } from './db'

export default function App() {
  const [orders, setOrders] = useState([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)

  async function load() {
    const data = await getOrdersSortedDesc()
    setOrders(data)
  }

  useEffect(() => {
    load()
  }, [])

  async function onAdd(order) {
    await addOrder(order)
    await load()
  }

  async function onEdit(id, partial) {
    await updateOrder(id, partial)
    setEditing(null)
    await load()
  }

  async function onToggle(id) {
    await toggleDelivered(id)
    await load()
  }

  async function onCancel(id) {
    await cancelOrder(id)
    await load()
  }

  async function onDelete(id) {
    if (confirm('Are you sure you want to delete this order?')) {
      await deleteOrder(id)
      await load()
    }
  }

  async function onSearch(q) {
    setSearch(q)
    const res = await searchOrders(q)
    setOrders(res)
  }

  async function startEdit(id) {
    const o = await getOrder(id)
    setEditing(o)
  }

  return (
    <div className="app">
      <header>
        <h1>Tracking Orders</h1>
      </header>

      <div className="search-row">
        <input
          aria-label="Search orders"
          placeholder="Search by client or product"
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
      </div>

      <OrderForm
        onAdd={onAdd}
        onEdit={onEdit}
        editing={editing}
        cancelEdit={() => setEditing(null)}
      />

      <OrderList orders={orders} onToggle={onToggle} onEdit={startEdit} onCancel={onCancel} onDelete={onDelete} />

      <footer>
        <small>Offline-capable PWA using IndexedDB</small>
      </footer>
    </div>
  )
}
