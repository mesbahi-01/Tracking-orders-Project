import React from 'react'
import { useTranslation } from 'react-i18next'

// Modal shown when several customers share a name.
// onPick(customer) for an existing one, onPick(null) for "new customer",
// onCancel() to abort the action that opened the picker.
export default function CustomerPicker({ customers, onPick, onCancel, title }) {
  const { t } = useTranslation()
  return (
    <div className="picker-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="picker-dialog">
        <h3>{title}</h3>
        <ul className="picker-list">
          {customers.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => onPick(c)}>
                <strong>{c.name}</strong>
                <span>{c.phone || t('customerPicker.noPhone')}</span>
                <span>{c.region || t('customerPicker.noRegion')}</span>
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="picker-new" onClick={() => onPick(null)}>
              {t('customerPicker.newCustomer')}
            </button>
          </li>
        </ul>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            {t('customerPicker.cancel')}
          </button>
        )}
      </div>
    </div>
  )
}
