import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { hasCoords } from '../../territory/geo'

export const STATUS_COLORS = { customer: '#1b7f3b', prospect: '#e08a00', competitor: '#c0392b' }

export function farmIcon(farm, selected) {
  const color = STATUS_COLORS[farm.status] || '#6b7280'
  const badge = farm.locationStatus === 'verify' ? '<b class="farm-dot-q">?</b>' : ''
  return L.divIcon({
    className: `farm-dot-wrap${selected ? ' selected' : ''}`,
    html: `<span class="farm-dot" style="background:${color}"></span>${badge}`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

export default function ClusterLayer({ farms, selectedId, onSelect }) {
  const map = useMap()
  const markersRef = useRef(new Map())
  const onSelectRef = useRef(onSelect)
  const selectedRef = useRef(selectedId)
  onSelectRef.current = onSelect
  selectedRef.current = selectedId

  useEffect(() => {
    const group = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50 })
    const markers = new Map()
    for (const f of farms) {
      if (!hasCoords(f)) continue
      const m = L.marker([f.lat, f.lng], { icon: farmIcon(f, f.id === selectedRef.current), keyboard: true, title: f.name })
      m.on('click', () => onSelectRef.current && onSelectRef.current(f))
      markers.set(f.id, { marker: m, farm: f })
      group.addLayer(m)
    }
    markersRef.current = markers
    map.addLayer(group)
    return () => { map.removeLayer(group); markersRef.current = new Map() }
  }, [map, farms])

  useEffect(() => {
    for (const [id, { marker, farm }] of markersRef.current) marker.setIcon(farmIcon(farm, id === selectedId))
  }, [selectedId, farms])

  return null
}
