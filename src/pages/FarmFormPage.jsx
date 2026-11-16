import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import FarmForm from '../components/territory/FarmForm'
import { useTerritory } from '../territory/useTerritory'
import { getFarm } from '../territory/store'

export default function FarmFormPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { loading, reload } = useTerritory()
  const [farm, setFarm] = useState(undefined)

  useEffect(() => {
    setFarm(undefined)
    if (!id) return
    let active = true
    getFarm(id).then((f) => { if (active) setFarm(f || null) }).catch((e) => { console.error(e); if (active) setFarm(null) })
    return () => { active = false }
  }, [id])

  if (id && farm === undefined) return <p>{t('loading')}</p>
  if (id && farm === null) {
    return (
      <div className="territory-page">
        <p>{t('territory.farms.notFound')}</p>
        <Link to="/farms">{t('territory.farms.backToList')}</Link>
      </div>
    )
  }
  if (loading) return <p>{t('loading')}</p>

  const customerId = params.get('customer') || ''
  const initial = farm || (customerId ? { customerId, status: 'customer' } : {})

  return (
    <div className="territory-page">
      <h2>{t(id ? 'territory.title.farmEdit' : 'territory.title.farmNew')}</h2>
      <FarmForm
        key={id || 'new'}
        initial={initial}
        onSaved={async (saved) => { await reload(); navigate(`/farms/${saved.id}`) }}
        onCancel={() => navigate(id ? `/farms/${id}` : '/farms')}
      />
    </div>
  )
}
