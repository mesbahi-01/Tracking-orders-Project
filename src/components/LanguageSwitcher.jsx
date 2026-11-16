import React from 'react'
import { useTranslation } from 'react-i18next'

const LANGS = [['en', 'English'], ['fr', 'Français']]

// variant 'select' (compact, app bar) or 'segmented' (More page).
export default function LanguageSwitcher({ variant = 'select' }) {
  const { t, i18n } = useTranslation()
  const current = (i18n.language || 'en').slice(0, 2)

  function change(lang) {
    i18n.changeLanguage(lang)
    try { localStorage.setItem('i18nextLng', lang) } catch {}
  }

  if (variant === 'segmented') {
    return (
      <div className="segmented language-switcher" role="group" aria-label={t('territory.more.language')}>
        {LANGS.map(([code, label]) => (
          <button key={code} type="button" lang={code} aria-pressed={current === code} onClick={() => change(code)}>{label}</button>
        ))}
      </div>
    )
  }

  return (
    <select className="language-switcher" value={i18n.language || 'en'} onChange={(e) => change(e.target.value)} aria-label={t('territory.more.language')}>
      {LANGS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
    </select>
  )
}
