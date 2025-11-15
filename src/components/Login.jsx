import React, { useState } from 'react'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Username and password required')
      return
    }
    // Simple authentication: store in localStorage
    localStorage.setItem('auth_user', JSON.stringify({ username, password }))
    onLogin({ username, password })
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Tracking Orders</h1>
        <form onSubmit={handleSubmit} className="login-form">
          <label>
            Username
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter username"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </label>
          {error && <p className="error-message">{error}</p>}
          <button type="submit">Login</button>
        </form>
        <p className="hint">Use any username/password to continue</p>
      </div>
    </div>
  )
}
