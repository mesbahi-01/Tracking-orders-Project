import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { parseCoordinates, isInMorocco } from '../../territory/geo'
import { parseNumberLoose } from '../../territory/normalize'
import { getCurrentPosition } from '../../territory/geolocation'
import { rememberFix, locationInputError } from '../../territory/farmForm'
import MapPicker from './MapPicker'
import { IconMap, IconLocate, IconClose } from './icons'

// value: { lat, lng (strings or numbers), locationSource, locationAccuracy }
export default function LocationInput({ value, onChange, contextPoints, onPastePendingChange }) {
  const { t } = useTranslation()
  const [paste, setPaste] = useState('')
  const [pasteError, setPasteError] = useState('')
  const [gpsError, setGpsError] = useState('')
  const [gpsBusy, setGpsBusy] = useState(false)
  const [picking, setPicking] = useState(false)
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])

  const lat = parseNumberLoose(value.lat)
  const lng = parseNumberLoose(value.lng)
  const has = lat !== null && lng !== null
  const inRange = has && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  const outside = inRange && !isInMorocco({ lat, lng })
  const lowAccuracy = value.locationSource === 'gps' && typeof value.locationAccuracy === 'number' && value.locationAccuracy > 100

  const fieldError = locationInputError(value.lat, value.lng)
  const emit = (patch) => onChange({ ...value, ...patch })
  const setField = (k) => (e) => { setPasteError(''); emit({ [k]: e.target.value, locationSource: 'typed', locationAccuracy: null }) }

  // Text left in the paste box that was not turned into a location blocks saving.
  const pending = paste.trim() !== ''
  const pendingRef = useRef(onPastePendingChange)
  pendingRef.current = onPastePendingChange
  useEffect(() => { if (pendingRef.current) pendingRef.current(pending) }, [pending])

  // Parsed only on paste, blur, Enter or the Use button, never per keystroke, so a
  // half-typed "35,4" can never become a position.
  function applyPaste(text) {
    setGpsError('')
    if (!text.trim()) { setPaste(''); setPasteError(''); return }
    const r = parseCoordinates(text)
    if (r.error) { setPasteError(t(`territory.location.err.${r.error}`)); return }
    setPaste(''); setPasteError('')
    emit({ lat: String(r.lat), lng: String(r.lng), locationSource: 'typed', locationAccuracy: null })
  }

  function onPasteEvent(e) {
    const text = e.clipboardData?.getData('text')
    if (typeof text !== 'string' || !text) return
    e.preventDefault()
    setPaste(text)
    applyPaste(text)
  }

  async function useGps() {
    if (gpsBusy) return
    setGpsBusy(true); setGpsError('')
    const r = await getCurrentPosition({ timeoutMs: 15000 })
    if (!active.current) return
    setGpsBusy(false)
    if (r.error) { setGpsError(t(`territory.location.gps.${r.error}`)); return }
    rememberFix(r)
    setPaste(''); setPasteError('')
    emit({ lat: String(r.lat), lng: String(r.lng), locationSource: 'gps', locationAccuracy: r.accuracy })
  }

  function clear() {
    setPaste(''); setPasteError(''); setGpsError('')
    emit({ lat: '', lng: '', locationSource: null, locationAccuracy: null })
  }

  return (
    <fieldset className="location-input">
      <legend>{t('territory.location.title')}</legend>
      <div className="location-paste">
        <label>{t('territory.location.paste')}
          <input value={paste} autoComplete="off"
            onChange={(e) => { setPaste(e.target.value); setPasteError('') }}
            onPaste={onPasteEvent}
            onBlur={(e) => applyPaste(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyPaste(e.currentTarget.value) } }} />
        </label>
        <button type="button" className="territory-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => applyPaste(paste)} disabled={!pending}>{t('territory.location.usePaste')}</button>
      </div>
      {pasteError && <p className="form-error" role="alert">{pasteError}</p>}
      <div className="location-latlng">
        <label>{t('territory.location.lat')}
          <input type="text" inputMode="decimal" value={value.lat ?? ''} onChange={setField('lat')} />
        </label>
        <label>{t('territory.location.lng')}
          <input type="text" inputMode="decimal" value={value.lng ?? ''} onChange={setField('lng')} />
        </label>
      </div>
      {fieldError && <p className="form-error" role="alert">{t(`territory.location.err.${fieldError}`)}</p>}
      <div className="territory-actions">
        <button type="button" className="territory-btn" onClick={() => setPicking(true)}><IconMap size={18} />{t('territory.location.chooseOnMap')}</button>
        <button type="button" className="territory-btn" disabled={gpsBusy} onClick={useGps}><IconLocate size={18} />{gpsBusy ? t('territory.location.locating') : t('territory.location.useGps')}</button>
        <button type="button" className="territory-btn btn-ghost" onClick={clear}><IconClose size={18} />{t('territory.location.clear')}</button>
      </div>
      {gpsError && <p className="form-error" role="alert">{gpsError}</p>}
      {lowAccuracy && <p className="territory-warning" role="alert">{t('territory.location.lowAccuracy', { m: Math.round(value.locationAccuracy) })}</p>}
      {outside && <p className="territory-warning" role="alert">{t('territory.location.outsideMorocco')}</p>}
      {picking && (
        <MapPicker
          initial={inRange ? { lat, lng } : null}
          contextPoints={contextPoints}
          onCancel={() => setPicking(false)}
          onConfirm={(p) => {
            setPicking(false); setPaste(''); setPasteError('')
            emit({ lat: String(p.lat), lng: String(p.lng), locationSource: 'map', locationAccuracy: null })
          }}
        />
      )}
    </fieldset>
  )
}
