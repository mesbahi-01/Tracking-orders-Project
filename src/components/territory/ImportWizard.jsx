import React, { memo, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { readWorkbook, sheetRows } from '../../territory/xlsxIO'
import { listCustomers, listFarms } from '../../territory/store'
import {
  IMPORT_FIELDS, guessMapping, rowsToIncoming, matchCustomers, findImportConflicts, groupConflictsByRow, applyImport, updateTarget,
} from '../../territory/importer'
import { IconUpload } from './icons'

const STEPS = ['file', 'preview', 'mapping', 'customers', 'conflicts', 'summary']
const PREVIEW_ROWS = 5

const SAVE_FIELDS = ['name', 'customerId', 'location', 'status', 'locationSource']
const yieldToUi = () => new Promise((r) => setTimeout(r, 0))

const cellText = (v) => (v === null || v === undefined ? '' : String(v))

function RowErrors({ errors }) {
  const { t } = useTranslation()
  if (!errors?.length) return null
  return (
    <details className="import-errors">
      <summary>{t('territory.import.rowErrorsTitle', { count: errors.length })}</summary>
      <ul>
        {errors.map((e, i) => (
          <li key={`${e.row}-${i}`}>
            {e.code
              ? t(`territory.import.rowError.${e.code}`, { row: e.row })
              : SAVE_FIELDS.includes(e.field)
                ? t(`territory.import.rowError.saveField.${e.field}`, { row: e.row })
                : t('territory.import.rowError.save', { row: e.row, message: e.message })}
          </li>
        ))}
      </ul>
    </details>
  )
}

// Memoised so a radio click re-renders only its own card.
const ConflictCard = memo(function ConflictCard({ farm, conflicts, canUpdate, value, onChoose, nf }) {
  const { t } = useTranslation()
  return (
    <div className="import-card">
      <p><strong>{farm.name}</strong> <span className="territory-muted">{t('territory.import.rowN', { row: farm.row })}</span></p>
      <ul>
        {conflicts.map((x, i) => (
          <li key={i}>
            {x.kind === 'same-name'
              ? t(x.existing.inFile ? 'territory.import.conflictSameNameFile' : 'territory.import.conflictSameName', { name: x.existing.name, row: x.existing.row })
              : t(x.existing.inFile ? 'territory.import.conflictNearbyFile' : 'territory.import.conflictNearby', { name: x.existing.name, distance: nf.format(x.distanceM), row: x.existing.row })}
          </li>
        ))}
      </ul>
      <fieldset className="data-modes">
        {['skip', ...(canUpdate ? ['update'] : []), 'new'].map((v) => (
          <label key={v}>
            <input type="radio" name={`farm-${farm.row}`} value={v} checked={value === v} onChange={() => onChoose(farm.row, v)} />
            <span>{t(`territory.import.decision.${v}`)}</span>
          </label>
        ))}
      </fieldset>
    </div>
  )
})

export default function ImportWizard({ onImported }) {
  const { t, i18n } = useTranslation()
  const nf = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language])
  const [step, setStep] = useState('file')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const [wb, setWb] = useState(null)
  const [fileName, setFileName] = useState('')
  const [sheet, setSheet] = useState('')
  const [mapping, setMapping] = useState({})
  const [incoming, setIncoming] = useState([])
  const [rowErrors, setRowErrors] = useState([])
  const [importNotes, setImportNotes] = useState([])
  const [matches, setMatches] = useState([])
  const [existingFarms, setExistingFarms] = useState([])
  const [customerDecisions, setCustomerDecisions] = useState({})
  const [conflictGroups, setConflictGroups] = useState([]) // [{customer, items: [{farm, conflicts, canUpdate}]}]
  const [farmDecisions, setFarmDecisions] = useState({})
  const [result, setResult] = useState(null)

  const table = useMemo(() => (wb && sheet ? sheetRows(wb, sheet) : { headers: [], rows: [] }), [wb, sheet])

  function reset() {
    setStep('file'); setWb(null); setFileName(''); setSheet(''); setMapping({}); setIncoming([]); setRowErrors([]); setImportNotes([])
    setMatches([]); setCustomerDecisions({}); setConflictGroups([]); setFarmDecisions({}); setResult(null); setError(null)
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    reset()
    setBusy(true)
    try {
      const book = await readWorkbook(file)
      if (!book.SheetNames.length) throw new Error(t('territory.import.noSheets'))
      setWb(book)
      setFileName(file.name)
      setSheet(book.SheetNames[0])
    } catch (err) {
      console.error('Could not read import file:', err)
      setError(t('territory.import.errorRead', { message: err?.message || String(err) }))
    } finally {
      setBusy(false)
    }
  }

  function toMapping() {
    setMapping(guessMapping(table.headers))
    setStep('mapping')
  }

  async function toCustomers() {
    setBusy(true)
    setError(null)
    try {
      const { customers, rowErrors: errs, notes } = rowsToIncoming(table.rows, mapping)
      const [existingCustomers, farms] = await Promise.all([listCustomers(), listFarms()])
      setIncoming(customers)
      setRowErrors(errs)
      setImportNotes(notes || [])
      setExistingFarms(farms)
      setMatches(matchCustomers(customers, existingCustomers))
      setCustomerDecisions({}) // never preselect: the user decides every match
      setStep('customers')
    } catch (err) {
      console.error('Import preparation failed:', err)
      setError(t('territory.import.errorPrepare', { message: err?.message || String(err) }))
    } finally {
      setBusy(false)
    }
  }

  async function toConflicts() {
    setBusy(true)
    setError(null)
    await yieldToUi() // let the busy state paint before the (indexed) scan
    try {
      const byRow = groupConflictsByRow(findImportConflicts(incoming, existingFarms, customerDecisions))
      const groups = []
      const decisions = {}
      for (const c of incoming) {
        const items = []
        for (const farm of c.farms) {
          const conflicts = byRow.get(farm.row)
          if (!conflicts) continue
          items.push({ farm, conflicts, canUpdate: !!updateTarget(conflicts) })
          decisions[farm.row] = 'skip'
        }
        if (items.length) groups.push({ customer: c, items })
      }
      setConflictGroups(groups)
      setFarmDecisions(decisions)
      setStep('conflicts')
    } catch (err) {
      console.error('Duplicate check failed:', err)
      setError(t('territory.import.errorPrepare', { message: err?.message || String(err) }))
    } finally {
      setBusy(false)
    }
  }

  const chooseFarm = useCallback((row, v) => setFarmDecisions((prev) => ({ ...prev, [row]: v })), [])

  async function runImport() {
    setBusy(true)
    setError(null)
    try {
      const sum = await applyImport(incoming, customerDecisions, farmDecisions)
      setResult(sum)
      setStep('summary')
      onImported?.()
    } catch (err) {
      console.error('Import failed:', err)
      setError(t('territory.import.errorImport', { message: err?.message || String(err) }))
    } finally {
      setBusy(false)
    }
  }

  const farmsOf = (customerId) => existingFarms.filter((f) => f.customerId === customerId).map((f) => f.name)
  const incomingByKey = useMemo(() => Object.fromEntries(incoming.map((c) => [c.key, c])), [incoming])
  const allDecided = matches.every((m) => customerDecisions[m.key])
  const farmCount = incoming.reduce((s, c) => s + c.farms.length, 0)
  const stepIndex = STEPS.indexOf(step)

  const fieldOptions = (
    <>
      <option value="">{t('territory.import.notUsed')}</option>
      {table.headers.map((h, i) => <option key={i} value={i}>{h || t('territory.import.columnN', { n: i + 1 })}</option>)}
    </>
  )

  return (
    <div className="import-wizard">
      <div className="wizard-progress">
        <p className="wizard-progress-text">
          <span className="wizard-step-name">{t(`territory.import.step.${step}`)}</span>
          <span className="territory-muted">{t('territory.import.stepOf', { n: stepIndex + 1, total: STEPS.length })}</span>
        </p>
        <div className="wizard-progress-bar" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={stepIndex + 1}
          aria-label={t('territory.import.stepOf', { n: stepIndex + 1, total: STEPS.length })}>
          <span style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      {step === 'file' && (
        <div className="import-step">
          <p className="territory-muted">{t('territory.import.fileHint')}</p>
          <label className="territory-btn data-file">
            <IconUpload size={18} />{busy ? t('territory.import.reading') : t('territory.import.pickFile')}
            <input type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFile} disabled={busy} />
          </label>
          {wb && (
            <>
              <p>{fileName}</p>
              {wb.SheetNames.length > 1 && (
                <label className="import-field">
                  <span>{t('territory.import.sheet')}</span>
                  <select value={sheet} onChange={(e) => setSheet(e.target.value)}>
                    {wb.SheetNames.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              )}
              <p className="territory-muted">{t('territory.import.rowCount', { count: table.rows.length })}</p>
              <div className="import-nav">
                <button type="button" className="territory-btn btn-primary" disabled={!table.rows.length} onClick={() => setStep('preview')}>
                  {t('territory.import.next')}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'preview' && (
        <div className="import-step">
          <div className="import-scroll">
            <table className="import-table">
              <thead><tr>{table.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
              <tbody>
                {table.rows.slice(0, PREVIEW_ROWS).map((r, i) => (
                  <tr key={i}>{table.headers.map((_, j) => <td key={j}>{cellText(r[j])}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="territory-muted">{t('territory.import.previewHint', { shown: Math.min(PREVIEW_ROWS, table.rows.length), count: table.rows.length })}</p>
          <div className="import-nav">
            <button type="button" className="territory-btn" onClick={() => setStep('file')}>{t('territory.import.back')}</button>
            <button type="button" className="territory-btn btn-primary" onClick={toMapping}>{t('territory.import.next')}</button>
          </div>
        </div>
      )}

      {step === 'mapping' && (
        <div className="import-step">
          <p className="territory-muted">{t('territory.import.mappingHint')}</p>
          {IMPORT_FIELDS.map((field) => (
            <label key={field} className="import-field">
              <span>{t(`territory.import.fields.${field}`)}</span>
              <select value={mapping[field] ?? ''}
                onChange={(e) => setMapping({ ...mapping, [field]: e.target.value === '' ? null : Number(e.target.value) })}>
                {fieldOptions}
              </select>
            </label>
          ))}
          {mapping.farmName == null && <p className="data-error">{t('territory.import.farmNameRequired')}</p>}
          <div className="import-nav">
            <button type="button" className="territory-btn" onClick={() => setStep('preview')}>{t('territory.import.back')}</button>
            <button type="button" className="territory-btn btn-primary" disabled={busy || mapping.farmName == null} onClick={toCustomers}>
              {t('territory.import.next')}
            </button>
          </div>
        </div>
      )}

      {step === 'customers' && (
        <div className="import-step">
          <p>{t('territory.import.found', { customers: incoming.length, farms: farmCount })}</p>
          <RowErrors errors={rowErrors} />
          {importNotes.map((n, i) => (
            <p key={i} className="territory-muted import-note" role="note">{t('territory.import.blankPhoneNote', { name: n.name, phones: n.phones })}</p>
          ))}
          {matches.length === 0 ? (
            <p className="territory-muted">{t('territory.import.noMatches')}</p>
          ) : (
            <>
              <p className="territory-muted">{t('territory.import.matchHint')}</p>
              {matches.map((m) => {
                const c = incomingByKey[m.key]
                const d = customerDecisions[m.key]
                const decide = (value) => setCustomerDecisions({ ...customerDecisions, [m.key]: value })
                return (
                  <div key={m.key} className={`import-card${d ? '' : ' import-undecided'}`}>
                    <p><strong>{c.name}</strong>{c.phone ? ` · ${c.phone}` : ''}{c.region ? ` · ${c.region}` : ''}</p>
                    <p className="territory-muted">{t('territory.import.inFile', { count: c.farms.length })}: {c.farms.map((f) => f.name).join(', ')}</p>
                    <p>{t('territory.import.existingWithName', { count: m.candidates.length })}</p>
                    {m.candidates.map((cand) => {
                      const selected = d?.type === 'existing' && d.customerId === cand.id
                      const names = farmsOf(cand.id)
                      return (
                        <div key={cand.id} className={`import-candidate${selected ? ' selected' : ''}`}>
                          <p><strong>{cand.name}</strong></p>
                          <p className="territory-muted">
                            {t('territory.import.phone')}: {cand.phone || '—'} · {t('territory.import.region')}: {cand.region || '—'}
                          </p>
                          <p className="territory-muted">
                            {t('territory.import.existingFarms', { count: names.length })}{names.length ? `: ${names.join(', ')}` : ''}
                          </p>
                          <button type="button" className={`territory-btn${selected ? ' btn-primary' : ''}`} aria-pressed={selected}
                            onClick={() => decide({ type: 'existing', customerId: cand.id })}>
                            {t('territory.import.sameCustomer')}
                          </button>
                        </div>
                      )
                    })}
                    <button type="button" className={`territory-btn${d?.type === 'new' ? ' btn-primary' : ''}`} aria-pressed={d?.type === 'new'}
                      onClick={() => decide({ type: 'new' })}>
                      {t('territory.import.newCustomer')}
                    </button>
                  </div>
                )
              })}
            </>
          )}
          {!allDecided && <p className="territory-muted">{t('territory.import.decideAll')}</p>}
          <div className="import-nav">
            <button type="button" className="territory-btn" onClick={() => setStep('mapping')}>{t('territory.import.back')}</button>
            <button type="button" className="territory-btn btn-primary" disabled={busy || !allDecided || farmCount === 0} onClick={toConflicts}>
              {busy ? t('territory.import.checking') : t('territory.import.next')}
            </button>
          </div>
        </div>
      )}

      {step === 'conflicts' && (
        <div className="import-step">
          {conflictGroups.length === 0 ? (
            <p className="territory-muted">{t('territory.import.noConflicts')}</p>
          ) : (
            <>
              <p className="territory-muted">{t('territory.import.conflictHint')}</p>
              {conflictGroups.map(({ customer, items }) => (
                <div key={customer.key} className="import-group">
                  <p><strong>{customer.name || t('territory.import.noOwner')}</strong></p>
                  {items.map(({ farm, conflicts, canUpdate }) => (
                    <ConflictCard key={farm.row} farm={farm} conflicts={conflicts} canUpdate={canUpdate}
                      value={farmDecisions[farm.row] || 'skip'} onChoose={chooseFarm} nf={nf} />
                  ))}
                </div>
              ))}
            </>
          )}
          <div className="import-nav">
            <button type="button" className="territory-btn" onClick={() => setStep('customers')} disabled={busy}>{t('territory.import.back')}</button>
            <button type="button" className="territory-btn btn-primary" onClick={runImport} disabled={busy}>
              {busy ? t('territory.import.importing') : t('territory.import.import')}
            </button>
          </div>
        </div>
      )}

      {step === 'summary' && result && (
        <div className="import-step data-ok" role="status">
          <p><strong>{t('territory.import.doneTitle')}</strong></p>
          <ul>
            <li>{t('territory.import.customersCreated', { count: result.customersCreated })}</li>
            <li>{t('territory.import.farmsCreated', { count: result.farmsCreated })}</li>
            <li>{t('territory.import.farmsUpdated', { count: result.farmsUpdated })}</li>
            <li>{t('territory.import.farmsSkipped', { count: result.farmsSkipped })}</li>
            <li>{t('territory.import.missingLocation', { count: result.missingLocation })}</li>
          </ul>
          <RowErrors errors={[...rowErrors, ...result.errors]} />
          <button type="button" className="territory-btn" onClick={reset}>{t('territory.import.again')}</button>
        </div>
      )}

      {error && <p className="data-error" role="alert">{error}</p>}
    </div>
  )
}
