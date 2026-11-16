import React from 'react'
import { useTranslation } from 'react-i18next'
import { IconSearch } from './icons'

// Small presentational pieces shared by the territory pages.

export function EmptyState({ icon, title, children }) {
  return (
    <div className="empty-state">
      {icon && <span className="empty-state-icon">{icon}</span>}
      <p className="empty-state-title">{title}</p>
      {children}
    </div>
  )
}

export function StatusBadge({ status }) {
  const { t } = useTranslation()
  return <span className={`territory-badge badge-status badge-${status}`}>{t(`territory.farms.status.${status}`)}</span>
}

// Search input with a leading magnifier; all props go to the <input>.
export function SearchField({ className = '', ...props }) {
  return (
    <span className={`search-field ${className}`}>
      <IconSearch size={18} className="search-field-icon" />
      <input type="search" {...props} />
    </span>
  )
}
