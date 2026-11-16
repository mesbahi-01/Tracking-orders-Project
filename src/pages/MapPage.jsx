import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTerritory } from '../territory/useTerritory'
import { applyFarmFilters } from '../territory/filters'
import { useFarmFilters, regionList } from '../territory/useFarmFilters'
import FarmMap from '../components/territory/FarmMap'
import FarmSheet from '../components/territory/FarmSheet'
import FilterPanel, { activeFilterCount } from '../components/territory/FilterPanel'
import { IconSearch, IconFilter, IconPin } from '../components/territory/icons'


export default function MapPage() {
  const { t, i18n } = useTranslation()
  const { farms, customers, customersById, loading } = useTerritory()
  const [filters, setFilters] = useFarmFilters()
  const [box, setBox] = useState(filters.text)
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [places, setPlaces] = useState(null)
  const [searchError, setSearchError] = useState('')
  const [searching, setSearching] = useState(false)
  const [focus, setFocus] = useState(null)
  const inFlight = useRef(false)
  const boxRef = useRef(filters.text)
  const wrapRef = useRef(null)
  const [height, setHeight] = useState(null)

  const shown = useMemo(() => applyFarmFilters(farms, customersById, filters), [farms, customersById, filters])
  const regions = useMemo(() => regionList(farms, customers), [farms, customers])
  const missingCount = useMemo(() => farms.filter((f) => f.locationStatus === 'missing').length, [farms])
  const selected = useMemo(() => shown.find((f) => f.id === selectedId) || null, [shown, selectedId])

  // Fill the viewport between the header and the bottom bar.
  useEffect(() => {
    function measure() {
      const el = wrapRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY
      const mobile = window.matchMedia('(max-width: 768px)').matches
      const bottom = mobile ? 64 : 0 // bottom nav height (see --bottomnav-h)
      setHeight(Math.max(240, window.innerHeight - top - bottom))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [loading])

  function onBoxChange(v) {
    setBox(v)
    boxRef.current = v
    setPlaces(null); setSearchError('')
    setFilters({ ...filters, text: v })
  }

  async function onSubmit(e) {
    e.preventDefault()
    const q = box.trim()
    if (!q || inFlight.current) return
    inFlight.current = true
    setSearching(true); setSearchError(''); setPlaces(null)
    try {
      const lang = (i18n.language || 'en').slice(0, 2)
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ma&limit=5&accept-language=${encodeURIComponent(lang)}&q=${encodeURIComponent(q)}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (boxRef.current.trim() !== q) return // text changed while waiting: drop stale results
      setPlaces(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      if (boxRef.current.trim() !== q) return
      setSearchError(t('territory.map.needsInternet'))
    } finally {
      inFlight.current = false
      setSearching(false)
    }
  }

  function pickPlace(p) {
    const lat = parseFloat(p.lat); const lng = parseFloat(p.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    // Panning only: nothing is ever created from a search result.
    setFocus({ lat, lng, zoom: 13 })
    setBox(p.name || p.display_name || '')
    boxRef.current = p.name || p.display_name || ''
    setFilters({ ...filters, text: '' })
    setPlaces(null)
  }

  if (loading) return <p className="territory-muted map-loading">{t('loading')}</p>

  const filterCount = activeFilterCount({ ...filters, text: '' })

  return (
    <div className="map-page" ref={wrapRef} style={height ? { height } : undefined}>
      {height && <FarmMap
        farms={shown}
        customersById={customersById}
        selectedId={selectedId}
        onSelect={(f) => setSelectedId(f.id)}
        focus={focus}
      />}
      <div className="map-topbar">
        <form className="map-search" onSubmit={onSubmit} role="search">
          <IconSearch size={20} className="map-search-icon" />
          <input type="search" value={box} onChange={(e) => onBoxChange(e.target.value)}
            placeholder={t('territory.map.searchPlaceholder')} aria-label={t('territory.map.searchPlaceholder')} />
          <button type="submit" className="map-search-go" disabled={searching || !box.trim()}>{searching ? t('territory.map.searching') : t('territory.map.search')}</button>
          <span className="map-search-sep" aria-hidden="true" />
          <button type="button" className={`map-filter-btn${filterCount ? ' is-on' : ''}`} onClick={() => setFilterOpen((v) => !v)} aria-expanded={filterOpen}
            aria-label={`${t('territory.filters.title')}${filterCount ? ` (${filterCount})` : ''}`} title={t('territory.filters.title')}>
            <IconFilter size={20} />
            {filterCount > 0 && <span className="map-filter-count" aria-hidden="true">{filterCount}</span>}
          </button>
        </form>
      </div>

      <div className="map-overlays">
        {searchError && <p className="map-note form-error" role="alert">{searchError}</p>}
        {box.trim() && !places && !searching && !searchError && (
          <p className="map-note">{t('territory.map.localCount', { count: shown.length })} · {t('territory.map.pressSearch', { q: box.trim() })}</p>
        )}
        {places && places.length === 0 && <p className="map-note">{t('territory.map.noPlaces')}</p>}
        {places && places.length > 0 && (
          <ul className="map-places" aria-label={t('territory.map.places')}>
            {places.map((p) => (
              <li key={p.place_id}><button type="button" onClick={() => pickPlace(p)}>{p.display_name}</button></li>
            ))}
          </ul>
        )}
      </div>
      {missingCount > 0 && (
        <Link className="map-missing-chip" to="/farms?ls=missing,verify"><IconPin size={16} />{t('territory.map.withoutLocation', { count: missingCount })}</Link>
      )}

      <FilterPanel value={filters} onChange={setFilters} regions={regions} customers={customers}
        open={filterOpen} onClose={() => setFilterOpen(false)} hideText />

      {selected && <FarmSheet farm={selected} customer={selected.customerId ? customersById[selected.customerId] : null} customers={customers} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
