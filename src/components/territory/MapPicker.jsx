import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, useMapEvents } from 'react-leaflet'
import { BaseLayers, LayerToggle, useMapLayer } from './BaseLayers'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '../../territory/tiles'
import { getLastFix } from '../../territory/farmForm'
import { hasCoords } from '../../territory/geo'

const pinIcon = L.divIcon({ className: 'map-pin', html: '<span></span>', iconSize: [28, 28], iconAnchor: [14, 28] })

function ClickToPlace({ onPlace }) {
  useMapEvents({ click: (e) => onPlace({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

function viewFor(initial, contextPoints) {
  if (initial) return { center: [initial.lat, initial.lng], zoom: 16 }
  const pts = (contextPoints || []).filter(hasCoords)
  if (pts.length) return { bounds: L.latLngBounds(pts.map((p) => [p.lat, p.lng])) }
  const fix = getLastFix()
  if (fix) return { center: [fix.lat, fix.lng], zoom: 14 }
  return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM }
}

export default function MapPicker({ initial, contextPoints, onConfirm, onCancel }) {
  const { t } = useTranslation()
  const [layer, setLayer] = useMapLayer()
  const [point, setPoint] = useState(initial ? { lat: initial.lat, lng: initial.lng } : null)
  const view = useMemo(() => viewFor(initial, contextPoints), []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="map-picker" role="dialog" aria-modal="true" aria-label={t('territory.location.chooseOnMap')}>
      <div className="map-picker-bar">
        <LayerToggle className="segmented" layer={layer} setLayer={setLayer} />
        <span className="territory-muted">{point ? t('territory.location.dragHint') : t('territory.location.tapHint')}</span>
      </div>
      <MapContainer {...view} className="map-picker-map" scrollWheelZoom>
        <BaseLayers layer={layer} />
        <ClickToPlace onPlace={setPoint} />
        {point && (
          <Marker
            position={[point.lat, point.lng]} icon={pinIcon} draggable
            eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); setPoint({ lat: p.lat, lng: p.lng }) } }}
          />
        )}
      </MapContainer>
      <div className="map-picker-bar map-picker-foot">
        <button type="button" className="btn-primary" disabled={!point} onClick={() => onConfirm(point)}>{t('territory.location.confirm')}</button>
        <button type="button" className="territory-btn" onClick={onCancel}>{t('territory.farms.form.cancel')}</button>
      </div>
    </div>
  )
}
