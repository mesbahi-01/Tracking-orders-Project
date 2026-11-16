import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import DataCopyButton from './DataCopyButton';

export default function Layout({ user, handleLogout }) {
  const { t } = useTranslation();

  return (
    <div className="app">
      <header>
        <h1>{t('app.title')}</h1>
        <div className="header-content">
          <nav>
            <Link to="/">{t('nav.orders')}</Link>
            <Link to="/clients">{t('nav.clients')}</Link>
              <Link to="/daily-reports">{t('nav.dailyReports')}</Link>
            </nav>
          <div className="header-right">
            <LanguageSwitcher />
            <div className="user-info">
              <span>{t('header.user')}: {user.username}</span>
              <button className="logout-btn" onClick={handleLogout}>{t('header.logout')}</button>
            </div>
          </div>
        </div>
      </header>
      <DataCopyButton />
      <main>
        <Outlet />
      </main>
      <footer>
        <small>{t('app.offline')}</small>
      </footer>
    </div>
  );
}
