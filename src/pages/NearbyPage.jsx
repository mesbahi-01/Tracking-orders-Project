import React, { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTerritory } from '../territory/useTerritory'
import { RADII_KM, findNearby, mapsLinks, hasCoords } from '../territory/geo'
import { getCurrentPosition } from '../territory/geolocation'
import { getSetting, setSetting } from '../territory/store'
import { customerOptionLabel, customerLabeler } from '../territory/customerLabel'
import { readNearby, buildNearbyParams, nextRadius, searchFarms } from '../territory/nearbyParams'
import { STATUS_COLORS } from '../components/territory/ClusterLayer'
import FarmMap from '../components/territory/FarmMap'
import { EmptyState, SearchField } from '../components/territory/ui'
import { IconLocate, IconNearby, IconDirections, IconChevronRight } from '../components/territory/icons'

const STATUSES = ['customer', 'prospect', 'competitor']

export default function NearbyPage() {
  const { t, i18n } = useTranslation()
  const [params, setParams] = useSearchParams()
  const { farms, customers, customersById, loading } = useTerritory()
  const [saved, setSaved] = useState(undefined) // undefined = not loaded yet
  const [query, setQuery] = useState('')
  const [statuses, setStatuses] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [gps, setGps] = useState({ state: 'idle' })
  const [attempt, setAttempt] = useState(0)
  const nf = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language])

  useEffect(() => {
    let alive = true
    getSetting('nearby.radius').then((v) => { if (alive) setSaved(v ?? null) }).catch(() => { if (alive) setSaved(null) })
    return () => { alive = false }
  }, [])

  const { farmId, me, radius } = readNearby(params, saved)

  function go(next) {
    setParams(buildNearbyParams({ farmId, me, radius, ...next }))
  }
  function chooseRadius(r) {
    setSetting('nearby.radius', r).catch((e) => console.error(e))
    setSaved(r)
    go({ radius: r })
  }

  // GPS request for ?me=1.
  useEffect(() => {
    if (!me) { setGps({ state: 'idle' }); return undefined }
    let alive = true
    setGps({ state: 'loading' })
    getCurrentPosition().then((res) => {
      if (!alive) return
      setGps(res.error ? { state: 'error', error: res.error } : { state: 'ok', lat: res.lat, lng: res.lng, accuracy: res.accuracy })
    })
    return () => { alive = false }
  }, [me, attempt])

  const originFarm = farmId ? farms.find((f) => f.id === farmId) || null : null
  const origin = originFarm
    ? (hasCoords(originFarm) ? { lat: originFarm.lat, lng: originFarm.lng } : null)
    : (me && gps.state === 'ok' ? { lat: gps.lat, lng: gps.lng } : null)

  const { results, missingCount } = useMemo(() => {
    if (!origin) return { results: [], missingCount: 0 }
    return findNearby(origin, farms, radius, { excludeId: originFarm?.id, statuses: statuses.length ? statuses : undefined })
  }, [origin?.lat, origin?.lng, farms, radius, statuses, originFarm?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const matches = useMemo(() => searchFarms(farms, customersById, query), [farms, customersById, query])
  const circle = origin ? { center: origin, radiusKm: radius } : null
  const mapFarms = useMemo(() => results.map((r) => r.farm), [results])
  const widen = nextRadius(radius)
  const labelOf = useMemo(() => customerLabeler(customers), [customers])
  const ownerOf = (f) => (f.customerId && customersById[f.customerId] && labelOf(customersById[f.customerId])) || f.ownerName || '—'

  function toggleStatus(s) {
    setStatuses((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))
  }

  if (loading || saved === undefined) return <p className="territory-muted">{t('loading')}</p>

  const originKey = origin ? `${farmId || 'me'}:${origin.lat},${origin.lng}` : 'none'

  return (
    <div className="nearby-page territory-page">
      <div className="territory-head"><h2>{t('territory.nearby.title')}</h2></div>

      <section className="surface-card nearby-origin-card">
        <div className="nearby-origin">
          <SearchField value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={t('territory.nearby.searchPlaceholder')} aria-label={t('territory.nearby.searchPlaceholder')} />
          <button type="button" className={`chip chip-gps${me ? ' btn-primary' : ''}`}
            onClick={() => { setQuery(''); if (me) setAttempt((n) => n + 1); else go({ farmId: null, me: true }) }}>
            <IconLocate size={18} />{t('territory.nearby.myLocation')}
          </button>
        </div>
        {query.trim() && (
          matches.length === 0
            ? <p className="territory-muted">{t('territory.nearby.noMatch')}</p>
            : <ul className="territory-list list-flat nearby-matches">
                {matches.map((f) => (
                  <li key={f.id}>
                    <button type="button" className={`territory-row nearby-select row-${f.status}`} onClick={() => { setQuery(''); setSelectedId(null); go({ farmId: f.id, me: false }) }}>
                      <span className="territory-row-main">
                        <strong dir="auto">{f.name}</strong>
                        <span className="territory-muted">{f.customerId && customersById[f.customerId] ? customerOptionLabel(customersById[f.customerId]) : f.ownerName || ''}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
        )}

        {originFarm && (
          <p className="nearby-from"><span className={`nearby-dot dot-${originFarm.status}`} aria-hidden="true" /><span dir="auto">{t('territory.nearby.from', { name: originFarm.name })}</span></p>
        )}
        {me && gps.state === 'loading' && <p className="territory-muted">{t('territory.nearby.locating')}</p>}
        {me && gps.state === 'error' && (
          <div className="territory-warning" role="alert">
            <p>{t(`territory.location.gps.${gps.error}`)}</p>
            <button type="button" className="territory-btn" onClick={() => setAttempt((n) => n + 1)}>{t('territory.nearby.retry')}</button>
          </div>
        )}
        {me && gps.state === 'ok' && (
          <>
            {Number.isFinite(gps.accuracy) && <p className="territory-muted">{t('territory.nearby.accuracy', { m: Math.round(gps.accuracy) })}</p>}
            {Number.isFinite(gps.accuracy) && gps.accuracy > 100 && (
              <p className="territory-warning" role="alert">{t('territory.nearby.lowAccuracy', { m: Math.round(gps.accuracy) })}</p>
            )}
          </>
        )}
        {farmId && !originFarm && <p className="territory-warning" role="alert">{t('territory.nearby.farmNotFound')}</p>}
        {originFarm && !origin && (
          <div className="territory-warning" role="alert">
            <p>{t('territory.nearby.noOriginLocation')}</p>
            <Link className="territory-btn" to={`/farms/${originFarm.id}/edit`}>{t('territory.farms.edit')}</Link>
          </div>
        )}
        {!farmId && !me && <p className="territory-muted">{t('territory.nearby.pickOrigin')}</p>}
      </section>

      <div className="segmented segmented-full" role="group" aria-label={t('territory.nearby.radius')}>
        {RADII_KM.map((r) => (
          <button key={r} type="button" className={r === radius ? 'btn-primary' : ''} aria-pressed={r === radius} onClick={() => chooseRadius(r)}>
            {r} {t('territory.nearby.km')}
          </button>
        ))}
      </div>
      <div className="chip-row chip-scroll" role="group" aria-label={t('territory.farms.form.status')}>
        <button type="button" className={`chip${statuses.length === 0 ? ' btn-primary' : ''}`} aria-pressed={statuses.length === 0} onClick={() => setStatuses([])}>{t('territory.nearby.allStatuses')}</button>
        {STATUSES.map((s) => (
          <button key={s} type="button" className={`chip chip-status chip-${s}${statuses.includes(s) ? ' btn-primary' : ''}`} aria-pressed={statuses.includes(s)} onClick={() => toggleStatus(s)}>
            {t(`territory.farms.status.${s}`)}
          </button>
        ))}
      </div>

      {origin && (
        <>
          <div className="nearby-map embedded-map">
            <FarmMap key={originKey} farms={mapFarms} selectedId={selectedId} onSelect={(f) => setSelectedId(f.id)}
              circle={circle} origin={origin} fitTo="circle" height={300} />
          </div>

          <p className="territory-count" aria-live="polite">{t('territory.nearby.count', { count: results.length, radius })}</p>

          {results.length === 0 ? (
            <EmptyState icon={<IconNearby size={28} />} title={t('territory.nearby.empty', { radius })}>
              {widen && <button type="button" className="territory-btn btn-primary" onClick={() => chooseRadius(widen)}>{t('territory.nearby.widen', { radius: widen })}</button>}
            </EmptyState>
          ) : (
            <ul className="territory-list">
              {results.map(({ farm, distanceKm }) => (
                <li key={farm.id} className={`nearby-row row-${farm.status}${farm.id === selectedId ? ' selected' : ''}`}>
                  <button type="button" className="nearby-select" onClick={() => setSelectedId(farm.id)} aria-pressed={farm.id === selectedId}>
                    <span className="nearby-dist">
                      <strong className="nearby-km">{distanceKm.toFixed(1)} <small>{t('territory.nearby.km')}</small></strong>
                      <span className="nearby-line">{t('territory.nearby.straightLine')}</span>
                    </span>
                    <span className="territory-row-main">
                      <strong dir="auto">{farm.name}</strong>
                      <span className="territory-muted"><bdi>{ownerOf(farm)}</bdi></span>
                      <span className="nearby-meta">
                        <span className={`nearby-dot dot-${farm.status}`} style={{ background: STATUS_COLORS[farm.status] || '#6b7280' }} aria-hidden="true" />
                        {t(`territory.farms.status.${farm.status}`)}
                        {' · '}<span className="num">{typeof farm.capacity === 'number' ? nf.format(farm.capacity) : '—'}</span>
                      </span>
                    </span>
                  </button>
                  <div className="nearby-actions">
                    <a className="icon-btn icon-btn-brand" href={mapsLinks({ lat: farm.lat, lng: farm.lng }).directions} target="_blank" rel="noopener noreferrer"
                      aria-label={`${t('territory.farms.directions')}: ${farm.name}`} title={t('territory.farms.directions')}><IconDirections size={20} /></a>
                    <Link className="icon-btn" to={`/farms/${farm.id}`} aria-label={`${t('territory.nearby.open')}: ${farm.name}`} title={t('territory.nearby.open')}><IconChevronRight size={20} /></Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {missingCount > 0 && <p className="territory-muted">{t('territory.nearby.missing', { count: missingCount })}</p>}
        </>
      )}
    </div>
  )
}
