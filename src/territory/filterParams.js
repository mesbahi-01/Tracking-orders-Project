const STATUSES = ['customer', 'prospect', 'competitor']
const LOCATION_STATUSES = ['ok', 'verify', 'missing']

const list = (v, allowed) => (v ? v.split(',').filter((x) => allowed.includes(x)) : [])
function num(v) {
  if (v === null || v === undefined || v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function filtersFromSearch(params) {
  return {
    text: params.get('q') || '',
    customerId: params.get('c') || '',
    statuses: list(params.get('s'), STATUSES),
    region: params.get('r') || '',
    capMin: num(params.get('min')),
    capMax: num(params.get('max')),
    locationStatuses: list(params.get('ls'), LOCATION_STATUSES),
  }
}

export function filtersToSearch(f = {}) {
  const p = new URLSearchParams()
  if (f.text) p.set('q', f.text)
  if (f.customerId) p.set('c', f.customerId)
  if (f.statuses?.length) p.set('s', f.statuses.join(','))
  if (f.region) p.set('r', f.region)
  if (typeof f.capMin === 'number' && Number.isFinite(f.capMin)) p.set('min', String(f.capMin))
  if (typeof f.capMax === 'number' && Number.isFinite(f.capMax)) p.set('max', String(f.capMax))
  if (f.locationStatuses?.length) p.set('ls', f.locationStatuses.join(','))
  return p
}
