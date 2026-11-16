import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { filtersFromSearch, filtersToSearch } from './filterParams'

// FarmFilters kept in the URL query so Map and Farms pages share them.
export function useFarmFilters() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => filtersFromSearch(params), [params])
  const setFilters = useCallback((f) => setParams(filtersToSearch(f), { replace: true }), [setParams])
  return [filters, setFilters]
}

export function regionList(farms, customers) {
  const set = new Set()
  for (const x of [...farms, ...customers]) if (x.region) set.add(x.region)
  return [...set].sort((a, b) => a.localeCompare(b))
}
