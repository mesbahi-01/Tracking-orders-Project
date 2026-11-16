import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Orders from './pages/Orders';
import DailyReports from './pages/DailyReportsPage';
import CustomersPage from './pages/CustomersPage';
import CustomerProfilePage from './pages/CustomerProfilePage';
import CustomerFormPage from './pages/CustomerFormPage';
import FarmsPage from './pages/FarmsPage';
import FarmDetailPage from './pages/FarmDetailPage';
import FarmFormPage from './pages/FarmFormPage';
import MapPage from './pages/MapPage';
import NearbyPage from './pages/NearbyPage';
import DashboardPage from './pages/DashboardPage';
import ReportsPage from './pages/ReportsPage';
import MorePage from './pages/MorePage';
// DataPage pulls in xlsx (~1 MB); keep it out of the main chunk.
const loadDataPage = () => import('./pages/DataPage');
const DataPage = lazy(loadDataPage);
import { runMigrationV3 } from './territory/migrate';
import { requestPersistentStorage } from './territory/persist';
import { isDbBlocked, onDbBlockedChange } from './db';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [migrated, setMigrated] = useState(false);
  const [dbBlocked, setDbBlocked] = useState(isDbBlocked);
  const { t } = useTranslation();

  useEffect(() => {
    const auth = localStorage.getItem('auth_user');
    if (auth) {
      try {
        setUser(JSON.parse(auth));
      } catch (e) {
        console.error('Failed to parse auth:', e);
        localStorage.removeItem('auth_user');
      }
    }
    setLoading(false);
  }, []);

  // Another tab still holds the old database version: the upgrade waits for it.
  useEffect(() => onDbBlockedChange(setDbBlocked), []);

  useEffect(() => {
    if (!user || migrated) return;
    let active = true;
    runMigrationV3()
      .catch((e) => console.error('Client migration failed:', e))
      .finally(() => { if (active) setMigrated(true); });
    return () => { active = false; };
  }, [user, migrated]);

  // Ask once that the browser not evict IndexedDB (the only copy of the data).
  useEffect(() => {
    if (user) requestPersistentStorage();
  }, [user]);

  // Prefetch the lazy xlsx chunks when idle so the service worker caches them for offline
  // use: the Data page, and the export modules used by Farms/Customers/Reports exports.
  useEffect(() => {
    if (!user) return;
    const prefetch = () => {
      loadDataPage().catch(() => {});
      import('./territory/sectionExport').catch(() => {});
      import('./territory/exporter').catch(() => {});
    };
    if ('requestIdleCallback' in window) {
      const handle = window.requestIdleCallback(prefetch, { timeout: 10000 });
      return () => window.cancelIdleCallback(handle);
    }
    const handle = setTimeout(prefetch, 3000);
    return () => clearTimeout(handle);
  }, [user]);

  function handleLogout() {
    localStorage.removeItem('auth_user');
    setUser(null);
  }

  if (dbBlocked) {
    return (
      <div className="loading db-blocked" role="alert">
        <p>{t('dbBlocked.title')}</p>
        <button type="button" className="btn-primary" onClick={() => window.location.reload()}>{t('dbBlocked.reload')}</button>
      </div>
    );
  }

  if (loading || (user && !migrated)) {
    return <div className="loading">{t('loading')}</div>;
  }

  return (
    <ErrorBoundary>
      <Routes>
        {!user ? (
          <Route path="/login" element={<Login onLogin={setUser} />} />
        ) : (
          <Route path="/" element={<Layout user={user} handleLogout={handleLogout} />}>
            <Route index element={<MapPage />} />
            <Route path="farms" element={<FarmsPage />} />
            <Route path="farms/new" element={<FarmFormPage />} />
            <Route path="farms/:id" element={<FarmDetailPage />} />
            <Route path="farms/:id/edit" element={<FarmFormPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="customers/new" element={<CustomerFormPage />} />
            <Route path="customers/:id" element={<CustomerProfilePage />} />
            <Route path="customers/:id/edit" element={<CustomerFormPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="nearby" element={<NearbyPage />} />
            <Route path="data" element={<Suspense fallback={<div className="loading">{t('loading')}</div>}><DataPage /></Suspense>} />
            <Route path="more" element={<MorePage user={user} handleLogout={handleLogout} />} />
            <Route path="orders" element={<Orders />} />
            <Route path="clients" element={<Navigate to="/customers" replace />} />
            <Route path="daily-reports" element={<DailyReports />} />
          </Route>
        )}
        <Route path="*" element={<Navigate to={user ? '/' : '/login'} />} />
      </Routes>
    </ErrorBoundary>
  );
}
