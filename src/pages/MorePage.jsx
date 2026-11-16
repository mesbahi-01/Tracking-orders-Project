import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../components/LanguageSwitcher'
import DataCopyButton from '../components/DataCopyButton'
import {
  IconDashboard, IconReports, IconData, IconOrders, IconNotes, IconChevronRight, IconGlobe, IconUser, IconLogout,
} from '../components/territory/icons'

const LINKS = [
  ['/dashboard', 'dashboard', IconDashboard],
  ['/reports', 'reports', IconReports],
  ['/data', 'data', IconData],
  ['/orders', 'orders', IconOrders],
  ['/daily-reports', 'dailyReports', IconNotes],
]

export default function MorePage({ user, handleLogout }) {
  const { t } = useTranslation()
  return (
    <div className="territory-page more-page">
      <h2>{t('territory.nav.more')}</h2>
      <ul className="more-list surface-card">
        {LINKS.map(([to, key, Icon]) => (
          <li key={key}>
            <Link to={to}>
              <span className="more-icon"><Icon size={20} /></span>
              <span className="more-label">{t(`territory.nav.${key}`)}</span>
              <IconChevronRight size={18} className="more-chevron" />
            </Link>
          </li>
        ))}
      </ul>

      <h3 className="more-heading">{t('territory.more.settings')}</h3>
      <div className="more-settings surface-card">
        <div className="more-setting">
          <span className="more-icon"><IconGlobe size={20} /></span>
          <span className="more-label">{t('territory.more.language')}</span>
          <LanguageSwitcher variant="segmented" />
        </div>
        <div className="more-setting">
          <span className="more-icon"><IconUser size={20} /></span>
          <span className="more-label" dir="auto">{user ? `${t('header.user')}: ${user.username}` : ''}</span>
          <button className="logout-btn" onClick={handleLogout}><IconLogout size={16} />{t('header.logout')}</button>
        </div>
      </div>

      <div className="more-settings surface-card more-data-copy">
        <p className="more-hint">{t('dataCopy.hint')}</p>
        <DataCopyButton />
      </div>
    </div>
  )
}
