import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import OrderForm from '../components/OrderForm'
import OrderList from '../components/OrderList'
import { getOrdersSortedDesc, addOrder, updateOrder, toggleDelivered, searchOrders, getOrder, cancelOrder, deleteOrder } from '../db'

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const { t } = useTranslation()

  // Load orders on component mount
  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const data = await getOrdersSortedDesc()
      setOrders(data)
    } catch (e) {
      console.error('Failed to load orders:', e)
    }
  }

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
    if (confirm(t('order.deleteConfirm'))) {
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
    window.scrollTo(0, 0)
  }

  return (
    <>
      <div className="search-row">
        <input
          aria-label="Search orders"
          placeholder={t('search.placeholder')}
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
    </>
  )
}
