import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import BottomNav from './territory/BottomNav';
import ErrorBoundary from './ErrorBoundary';
import { getBackupStatus, backupReminderDays } from '../territory/backupStatus';
import {
  LogoMark, IconMap, IconFarm, IconCustomers, IconNearby, IconDashboard, IconReports, IconData, IconOrders, IconNotes, IconLogout,
} from './territory/icons';

function BackupChip() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [days, setDays] = useState(null);

  useEffect(() => {
    let active = true;
    getBackupStatus()
      .then((s) => { if (active) setDays(backupReminderDays(s)); })
      .catch((e) => console.error('Backup status failed:', e));
    return () => { active = false; };
  }, [pathname]);

  if (days === null || pathname === '/data') return null;
  const full = days === Infinity ? t('territory.backup.chipNever') : t('territory.backup.chip', { count: days });
  return (
    <Link to="/data" className="backup-chip" aria-label={full} title={full}>
      <span className="backup-chip-dot" aria-hidden="true" />
      <span className="backup-chip-short" aria-hidden="true">{t('territory.backup.chipShort')}</span>
      <span className="backup-chip-long" aria-hidden="true">{full}</span>
    </Link>
  );
}

const NAV = [
  ['/', 'map', IconMap, true],
  ['/farms', 'farms', IconFarm],
  ['/customers', 'customers', IconCustomers],
  ['/nearby', 'nearby', IconNearby],
  ['/dashboard', 'dashboard', IconDashboard],
  ['/reports', 'reports', IconReports],
  ['/data', 'data', IconData],
  ['/orders', 'orders', IconOrders],
  ['/daily-reports', 'dailyReports', IconNotes],
];

export default function Layout({ user, handleLogout }) {
  const { t } = useTranslation();
  const { pathname, search } = useLocation();

  return (
    <div className="app">
      <header className="app-bar">
        <div className="app-bar-row">
          <Link to="/" className="app-brand">
            <LogoMark size={30} />
            <h1 className="app-title">{t('app.title')}</h1>
          </Link>
          <div className="app-bar-end">
            <BackupChip />
            <div className="app-user">
              <LanguageSwitcher />
              <span>{t('header.user')}: {user.username}</span>
              <button className="logout-btn" onClick={handleLogout}>
                <IconLogout size={16} />{t('header.logout')}
              </button>
            </div>
          </div>
        </div>
        <nav className="app-nav" aria-label={t('territory.nav.primary')}>
          {NAV.map(([to, key, Icon, end]) => (
            <NavLink key={key} to={to} end={end}><Icon size={16} />{t(`territory.nav.${key}`)}</NavLink>
          ))}
        </nav>
      </header>
      <main>
        <ErrorBoundary key={pathname} resetKey={pathname + search}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <BottomNav />
      <footer>
        <small>{t('app.offline')}</small>
      </footer>
    </div>
  );
}
