import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import CustomerForm from '../components/territory/CustomerForm'
import { useTerritory } from '../territory/useTerritory'
import { getCustomer } from '../territory/store'

export default function CustomerFormPage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { customers, loading, reload } = useTerritory()
  const [customer, setCustomer] = useState(undefined)
  const regions = useMemo(() => [...new Set(customers.map((c) => c.region).filter(Boolean))].sort(), [customers])

  useEffect(() => {
    if (!id) return
    let active = true
    getCustomer(id).then((c) => { if (active) setCustomer(c || null) })
    return () => { active = false }
  }, [id])

  if (id && customer === undefined) return <p>{t('loading')}</p>
  if (id && customer === null) {
    return (
      <div className="territory-page">
        <p>{t('territory.customers.notFound')}</p>
        <Link to="/customers">{t('territory.customers.backToList')}</Link>
      </div>
    )
  }
  if (loading) return <p>{t('loading')}</p>

  return (
    <div className="territory-page">
      <h2>{t(id ? 'territory.title.customerEdit' : 'territory.title.customerNew')}</h2>
      <CustomerForm
        customer={customer || undefined}
        regions={regions}
        onSaved={async (saved) => { await reload(); navigate(`/customers/${saved.id}`) }}
        onCancel={() => navigate(id ? `/customers/${id}` : '/customers')}
      />
    </div>
  )
}
