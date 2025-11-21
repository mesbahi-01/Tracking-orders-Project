import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Login from './components/Login'
import OrderForm from './components/OrderForm'
import OrderList from './components/OrderList'
import LanguageSwitcher from './components/LanguageSwitcher'
import { getOrdersSortedDesc, addOrder, updateOrder, toggleDelivered, searchOrders, getOrder, cancelOrder, deleteOrder } from './db'

export default function App() {
  const [orders, setOrders] = useState([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const { t } = useTranslation()

  // Check if user is already logged in on app load
  useEffect(() => {
    const auth = localStorage.getItem('auth_user')
    if (auth) {
      try {
        setUser(JSON.parse(auth))
      } catch (e) {
        console.error('Failed to parse auth:', e)
        localStorage.removeItem('auth_user')
      }
    }
    setLoading(false)
  }, [])

  // Load orders when user logs in
  useEffect(() => {
    if (user) {
      load()
    }
  }, [user])

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
  }

  function handleLogout() {
    // Clear auth only, keep IndexedDB data
    localStorage.removeItem('auth_user')
    setUser(null)
    // Don't clear orders - they persist in IndexedDB
    setSearch('')
    setEditing(null)
  }

  if (loading) {
    return <div className="loading">{t('loading')}</div>
  }

  if (!user) {
    return <Login onLogin={setUser} />
  }

  return (
    <div className="app">
      <header>
        <div className="header-content">
          <h1>{t('app.title')}</h1>
          <div className="header-right">
            <LanguageSwitcher />
            <div className="user-info">
              <span>{t('header.user')}: {user.username}</span>
              <button className="logout-btn" onClick={handleLogout}>{t('header.logout')}</button>
            </div>
          </div>
        </div>
      </header>

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

      <footer>
        <small>{t('app.offline')}</small>
      </footer>
    </div>
  )
}
