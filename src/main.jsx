import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      // registration failed
      console.warn('SW registration failed:', err)
    })
  })
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
