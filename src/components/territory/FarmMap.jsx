import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, Circle, useMap } from 'react-leaflet'
import ClusterLayer from './ClusterLayer'
import { BaseLayers, LayerToggle, useMapLayer } from './BaseLayers'
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '../../territory/tiles'
import { getCurrentPosition } from '../../territory/geolocation'
import { hasCoords, circleBounds } from '../../territory/geo'
import { IconPlus, IconMinus, IconLocate } from './icons'

const dotIcon = L.divIcon({ className: 'my-loc-wrap', html: '<span class="my-loc"></span>', iconSize: [18, 18], iconAnchor: [9, 9] })
const placeIcon = L.divIcon({ className: 'map-pin', html: '<span></span>', iconSize: [28, 28], iconAnchor: [14, 28] })

// Computed from the center/radius; never call getBounds() on a Circle not yet on a map.
function circleLatLngBounds(circle) {
  return L.latLngBounds(circleBounds(circle.center, circle.radiusKm))
}

function initialView(located, fitTo, circle) {
  if (fitTo === 'circle' && circle) return { bounds: circleLatLngBounds(circle) }
  if (located.length === 1) return { center: [located[0].lat, located[0].lng], zoom: 15 }
  if (located.length) return { bounds: L.latLngBounds(located.map((f) => [f.lat, f.lng])) }
  return { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM }
}

// Floating overlays (search pill, layer toggle, zoom/locate, chips, sheet) are siblings of the map
// inside its parent. Measure them so fitted markers stay clear; fall back to sane defaults.
const OVERLAY_SEL = '.map-topbar, .map-overlays, .farm-map-controls, .farm-map-fabs, .map-missing-chip, .farm-sheet'
export function fitOptions(map) {
  const base = { top: 120, bottom: 80, right: 56 }
  const fallback = { paddingTopLeft: [16, base.top + 16], paddingBottomRight: [16 + base.right, base.bottom + 16] }
  try {
    const box = map.getContainer().getBoundingClientRect()
    const host = map.getContainer().parentElement?.parentElement
    if (!host || !box.width || !box.height) return fallback
    let top = 0, bottom = 0, right = 0
    host.querySelectorAll(OVERLAY_SEL).forEach((el) => {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return
      const t = Math.max(0, r.top - box.top), b = Math.min(box.height, r.bottom - box.top)
      if (b <= 0 || t >= box.height) return
      if ((t + b) / 2 < box.height / 2) top = Math.max(top, b)
      else bottom = Math.max(bottom, box.height - t)
      // Only narrow right-edge buttons reduce the usable width, not wide bars/sheets.
      if (r.width < box.width / 2 && r.right > box.right - 40) right = Math.max(right, box.right - r.left)
    })
    const room = Math.max(0, box.height - 100)
    const T = Math.min(top || base.top, room / 2), B = Math.min(bottom || base.bottom, room / 2)
    return { paddingTopLeft: [16, T + 16], paddingBottomRight: [16 + (right || base.right), B + 16] }
  } catch {
    return fallback
  }
}

// Fits the initial farm view once, after the sibling overlays exist in the DOM.
function InitialFit({ view }) {
  const map = useMap()
  useEffect(() => {
    if (view.bounds) map.fitBounds(view.bounds, { ...fitOptions(map), animate: false })
    else if (view.center) map.fitBounds(L.latLngBounds([view.center, view.center]), { ...fitOptions(map), maxZoom: view.zoom, animate: false })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// Re-fits when the circle (center/radius) changes while fitTo === 'circle'.
function CircleFit({ circle, fitTo }) {
  const map = useMap()
  const key = circle ? `${circle.center.lat},${circle.center.lng},${circle.radiusKm}` : ''
  useEffect(() => {
    if (fitTo === 'circle' && circle) map.fitBounds(circleLatLngBounds(circle), fitOptions(map))
  }, [key, fitTo]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// Keeps Leaflet's cached size in sync (page height measured late, rotation, window resize).
function SizeWatcher() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    map.invalidateSize()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [map])
  return null
}

function FocusPoint({ focus }) {
  const map = useMap()
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], focus.zoom || 14)
  }, [focus, map])
  return null
}

// Clicks and wheel on a floating control must not reach the map underneath.
function useNoPropagation() {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) { L.DomEvent.disableClickPropagation(ref.current); L.DomEvent.disableScrollPropagation(ref.current) }
  }, [])
  return ref
}

function Controls({ layer, setLayer, onFix }) {
  const map = useMap()
  const { t } = useTranslation()
  const ref = useNoPropagation()
  const fabRef = useNoPropagation()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function locate() {
    if (busy) return
    setBusy(true); setErr('')
    const res = await getCurrentPosition()
    setBusy(false)
    if (res.error) { setErr(t(`territory.location.gps.${res.error}`)); return }
    onFix({ lat: res.lat, lng: res.lng })
    map.flyTo([res.lat, res.lng], Math.max(map.getZoom(), 14))
  }

  return (
    <>
      <div ref={ref} className="farm-map-controls">
        <LayerToggle className="segmented farm-map-toggle" layer={layer} setLayer={setLayer} />
      </div>
      <div ref={fabRef} className="farm-map-fabs">
        {err && <p className="farm-map-err" role="alert">{err}</p>}
        <div className="farm-map-zoom">
          <button type="button" className="farm-map-btn" onClick={() => map.zoomIn()} aria-label={t('territory.map.zoomIn')} title={t('territory.map.zoomIn')}><IconPlus size={20} /></button>
          <button type="button" className="farm-map-btn" onClick={() => map.zoomOut()} aria-label={t('territory.map.zoomOut')} title={t('territory.map.zoomOut')}><IconMinus size={20} /></button>
        </div>
        <button type="button" className={`farm-map-btn farm-map-locate${busy ? ' is-busy' : ''}`} onClick={locate} disabled={busy} aria-label={t('territory.map.myLocation')} title={t('territory.map.myLocation')}>
          <IconLocate size={20} />
        </button>
      </div>
    </>
  )
}

export default function FarmMap({ farms, selectedId, onSelect, circle, origin, fitTo = 'farms', height, focus }) {
  const [layer, setLayer] = useMapLayer()
  const [myLoc, setMyLoc] = useState(null)
  const located = useMemo(() => farms.filter(hasCoords), [farms])
  // Initial view only: later filter changes never move the map.
  const view = useMemo(() => initialView(located, fitTo, circle), []) // eslint-disable-line react-hooks/exhaustive-deps


  return (
    <div className="farm-map" style={height ? { height } : undefined}>
      <MapContainer {...view} className="farm-map-canvas" scrollWheelZoom zoomControl={false}>
        <BaseLayers layer={layer} />
        <ClusterLayer farms={located} selectedId={selectedId} onSelect={onSelect} />
        {circle && <Circle center={[circle.center.lat, circle.center.lng]} radius={circle.radiusKm * 1000} pathOptions={{ color: '#0f766e', weight: 2, fillOpacity: 0.08 }} />}
        {origin && <Marker position={[origin.lat, origin.lng]} icon={placeIcon} interactive={false} />}
        {myLoc && <Marker position={[myLoc.lat, myLoc.lng]} icon={dotIcon} interactive={false} />}
        {focus && <Marker position={[focus.lat, focus.lng]} icon={placeIcon} interactive={false} />}
        <SizeWatcher />
        {fitTo !== 'circle' && located.length > 0 && <InitialFit view={view} />}
        <CircleFit circle={circle} fitTo={fitTo} />
        <FocusPoint focus={focus} />
        <Controls layer={layer} setLayer={setLayer} onFix={setMyLoc} />
      </MapContainer>
    </div>
  )
}
