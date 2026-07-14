import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Layout from './components/Layout';
import Orders from './pages/Orders';
import Clients from './pages/Clients';
import DailyReports from './pages/DailyReportsPage';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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

  function handleLogout() {
    localStorage.removeItem('auth_user');
    setUser(null);
  }

  if (loading) {
    return <div className="loading">{t('loading')}</div>;
  }

  return (
    <Routes>
      {!user ? (
        <Route path="/login" element={<Login onLogin={setUser} />} />
      ) : (
        <Route path="/" element={<Layout user={user} handleLogout={handleLogout} />}>
          <Route index element={<Orders />} />
          <Route path="clients" element={<Clients />} />
          <Route path="daily-reports" element={<DailyReports />} />
        </Route>
      )}
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} />} />
    </Routes>
  );
}
