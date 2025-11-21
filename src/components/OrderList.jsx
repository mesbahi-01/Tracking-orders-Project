import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

function formatDate(dateStr) {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr + 'T00:00:00')
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${year}/${month}/${day}`
  } catch {
    return '-'
  }
}

function formatDateTime(isoStr) {
  if (!isoStr) return '-'
  try {
    const date = new Date(isoStr)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}/${month}/${day} ${hours}:${minutes}`
  } catch {
    return '-'
  }
}

function OrderCard({ order, onToggle, onEdit, onCancel, onDelete }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`order-card ${order.delivered ? 'delivered' : ''} ${order.cancelled ? 'cancelled' : ''}`}>
      <div className="order-main">
        <div className="meta">
          <button
            type="button"
            className="expand-btn"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? t('expand.collapse') : t('expand.expand')}
          >
            {expanded ? '▼' : '▶'}
          </button>
          <strong>{order.client}</strong>
          <span className={`status ${order.cancelled ? 'cancelled' : order.delivered ? 'delivered' : 'pending'}`}>
            {order.cancelled ? t('order.status.cancelled') : order.delivered ? t('order.status.delivered') : t('order.status.pending')}
          </span>
        </div>
        <div className="dates">
          <small>{t('order.desired')}: {formatDate(order.desiredDate)}</small>
          <small>{t('order.created')}: {formatDateTime(order.createdAt)}</small>
        </div>
      </div>

      {expanded && order.items && order.items.length > 0 && (
        <div className="items-detail">
          {order.items.map((item, idx) => (
            <div key={idx} className="item-detail-row">
              <span className="item-detail-product">{item.product}</span>
              <span className="item-detail-qty">{item.quantity} {item.unit}</span>
            </div>
          ))}
        </div>
      )}

      <div className="order-actions">
        <button onClick={() => onToggle(order.id)}>
          {order.delivered ? t('order.markUndelivered') : t('order.markDelivered')}
        </button>
        <button className="secondary" onClick={() => onEdit(order.id)}>
          {t('order.edit')}
        </button>
        <button className={order.cancelled ? 'secondary' : 'danger'} onClick={() => onCancel(order.id)}>
          {order.cancelled ? t('order.undo') : t('order.cancel')}
        </button>
        <button className="danger" onClick={() => onDelete(order.id)}>
          {t('order.delete')}
        </button>
      </div>
    </div>
  )
}

export default function OrderList({ orders, onToggle, onEdit, onCancel, onDelete }) {
  const { t } = useTranslation()
  if (!orders || orders.length === 0) return <p className="empty">{t('empty.noOrders')}</p>

  return (
    <div className="order-list">
      {orders.map(o => (
        <OrderCard key={o.id} order={o} onToggle={onToggle} onEdit={onEdit} onCancel={onCancel} onDelete={onDelete} />
      ))}
    </div>
  )
}
