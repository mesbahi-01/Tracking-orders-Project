import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './locales/en.json'
import fr from './locales/fr.json'

const resources = {
  en: { translation: en },
  fr: { translation: fr }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: localStorage.getItem('i18nextLng') || 'en',
    interpolation: { escapeValue: false },
    detection: {
      // check localStorage first, then navigator
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  })

export default i18n
