import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function Login({ onLogin }) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError(t('login.required'))
      return
    }
    // Simple authentication: store in localStorage
    localStorage.setItem('auth_user', JSON.stringify({ username, password }))
    onLogin({ username, password })
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>{t('app.title')}</h1>
        <form onSubmit={handleSubmit} className="login-form">
          <label>
            {t('login.username')}
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder={t('login.placeholderUsername')}
              required
            />
          </label>
          <label>
            {t('login.password')}
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t('login.placeholderPassword')}
              required
            />
          </label>
          {error && <p className="error-message">{error}</p>}
          <button type="submit">{t('login.login')}</button>
        </form>
        <p className="hint">{t('login.hint')}</p>
      </div>
    </div>
  )
}
