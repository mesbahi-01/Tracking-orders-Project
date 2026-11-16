import React from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { IconMap, IconFarm, IconCustomers, IconNearby, IconMore } from './icons'

const ITEMS = [
  { to: '/', key: 'map', end: true, Icon: IconMap },
  { to: '/farms', key: 'farms', Icon: IconFarm },
  { to: '/customers', key: 'customers', Icon: IconCustomers },
  { to: '/nearby', key: 'nearby', Icon: IconNearby },
  { to: '/more', key: 'more', Icon: IconMore },
]

export default function BottomNav() {
  const { t } = useTranslation()
  return (
    <nav className="bottom-nav" aria-label={t('territory.nav.primary')}>
      {ITEMS.map(({ to, key, end, Icon }) => (
        <NavLink key={key} to={to} end={end} className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}>
          <span className="bottom-nav-icon"><Icon size={22} /></span>
          <span className="bottom-nav-label">{t(`territory.nav.${key}`)}</span>
        </NavLink>
      ))}
    </nav>
  )
}
