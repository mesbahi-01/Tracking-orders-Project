import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listCustomers, listFarms } from './store'

export function useTerritory() {
  const [customers, setCustomers] = useState([])
  const [farms, setFarms] = useState([])
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  const reload = useCallback(async () => {
    try {
      const [c, f] = await Promise.all([listCustomers(), listFarms()])
      if (!mounted.current) return
      setCustomers(c)
      setFarms(f)
    } catch (e) {
      console.error('Failed to load territory data:', e)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    reload()
    return () => { mounted.current = false }
  }, [reload])

  const customersById = useMemo(() => {
    const map = {}
    for (const c of customers) map[c.id] = c
    return map
  }, [customers])

  return { customers, farms, customersById, loading, reload }
}
