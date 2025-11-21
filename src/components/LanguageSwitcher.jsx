import React from 'react'
import { useTranslation } from 'react-i18next'

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()

  function change(e) {
    const lang = e.target.value
    i18n.changeLanguage(lang)
    try { localStorage.setItem('i18nextLng', lang) } catch {}
  }

  return (
    <select className="language-switcher" value={i18n.language || 'en'} onChange={change} aria-label="Language">
      <option value="en">English</option>
      <option value="fr">Français</option>
    </select>
  )
}
