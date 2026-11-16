import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TileLayer } from 'react-leaflet'
import { TILE_LAYERS } from '../../territory/tiles'
import { getSetting, setSetting } from '../../territory/store'

// Layer choice ('streets' | 'satellite') persisted in setting 'map.layer'.
export function useMapLayer() {
  const [layer, setLayerState] = useState('streets')
  useEffect(() => {
    let active = true
    getSetting('map.layer')
      .then((v) => { if (active && (v === 'streets' || v === 'satellite')) setLayerState(v) })
      .catch(() => {})
    return () => { active = false }
  }, [])
  const setLayer = (l) => {
    setLayerState(l)
    setSetting('map.layer', l).catch((e) => console.error(e))
  }
  return [layer, setLayer]
}

export function BaseLayers({ layer }) {
  const base = TILE_LAYERS[layer]
  return (
    <>
      <TileLayer key={layer} url={base.url} attribution={base.attribution} maxZoom={base.maxZoom} crossOrigin={base.crossOrigin} />
      {layer === 'satellite' && <TileLayer url={TILE_LAYERS.labels.url} maxZoom={TILE_LAYERS.labels.maxZoom} crossOrigin={TILE_LAYERS.labels.crossOrigin} />}
    </>
  )
}

export function LayerToggle({ layer, setLayer, className }) {
  const { t } = useTranslation()
  return (
    <div className={className} role="group" aria-label={t('territory.map.layer')}>
      <button type="button" className={layer === 'streets' ? 'btn-primary' : ''} aria-pressed={layer === 'streets'} onClick={() => setLayer('streets')}>{t('territory.location.streets')}</button>
      <button type="button" className={layer === 'satellite' ? 'btn-primary' : ''} aria-pressed={layer === 'satellite'} onClick={() => setLayer('satellite')}>{t('territory.location.satellite')}</button>
    </div>
  )
}
