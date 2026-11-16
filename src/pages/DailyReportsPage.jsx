import React, { useEffect, useState } from 'react'
import DailyReportsForm from '../components/DailyReportsForm'
import DailyReportsList from '../components/DailyReportsList'
import { loadDailyReports, saveDailyReports } from '../lib/dailyReportsStorage'
import { getClientNames } from '../clients'
import '../dailyReports.css'

export default function DailyReportsPage() {
  const [reports, setReports] = useState([])
  const [clients, setClients] = useState([])
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [editingReport, setEditingReport] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('all')

  useEffect(() => {
    loadReports()
    refreshClients()
  }, [])

  function refreshClients() {
    getClientNames()
      .then(setClients)
      .catch((error) => console.error('Failed to load clients:', error))
  }

  async function loadReports() {
    try {
      const data = await loadDailyReports()
      setReports(data)
    } catch (error) {
      console.error('Failed to load daily reports:', error)
      setErrorMessage('Failed to load reports. Please try again.')
    }
  }

  function getFilteredReports() {
    let filtered = reports

    // Apply date filter
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    if (dateFilter === 'day') {
      filtered = filtered.filter((report) => {
        const reportDate = new Date(report.date)
        return reportDate.toDateString() === today.toDateString()
      })
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      filtered = filtered.filter((report) => {
        const reportDate = new Date(report.date)
        return reportDate >= weekAgo && reportDate <= today
      })
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(today)
      monthAgo.setDate(monthAgo.getDate() - 30)
      filtered = filtered.filter((report) => {
        const reportDate = new Date(report.date)
        return reportDate >= monthAgo && reportDate <= today
      })
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((report) => {
        const matchesClient = report.client.toLowerCase().includes(query)
        const matchesNotes = report.notes.toLowerCase().includes(query)
        const matchesDate = report.date.includes(searchQuery)
        return matchesClient || matchesNotes || matchesDate
      })
    }

    return filtered
  }

  async function handleSubmit(report) {
    try {
      let updated
      if (editingReport) {
        updated = reports.map((r) => (r.id === report.id ? report : r))
        setSuccessMessage('Daily report updated successfully!')
      } else {
        updated = [...reports, report]
        setSuccessMessage('Daily report saved successfully!')
      }
      await saveDailyReports(updated)
      setReports(updated)
      setEditingReport(null)
      refreshClients()
      setTimeout(() => setSuccessMessage(''), 4000)
      setErrorMessage('')
    } catch (error) {
      console.error('Failed to save report:', error)
      setErrorMessage('Failed to save report. Please try again.')
    }
  }

  async function handleDelete(reportId) {
    if (confirm('Are you sure you want to delete this report?')) {
      try {
        const updated = reports.filter((r) => r.id !== reportId)
        await saveDailyReports(updated)
        setReports(updated)
        setSuccessMessage('Daily report deleted.')
        setTimeout(() => setSuccessMessage(''), 4000)
      } catch (error) {
        console.error('Failed to delete report:', error)
        setErrorMessage('Failed to delete report. Please try again.')
      }
    }
  }

  function handleError(message) {
    setErrorMessage(message)
    setTimeout(() => setErrorMessage(''), 4000)
  }

  const filteredReports = getFilteredReports()

  return (
    <main className="page">
      <section className="card">
        <h1 className="page__title">Daily Reports</h1>
        <p className="page__subtitle">
          Capture a date, client, and voice notes for your daily activities.
        </p>
      </section>

      {successMessage && (
        <div className="status-banner status-banner--success">
          ✓ {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="status-banner status-banner--error">
          ✗ {errorMessage}
        </div>
      )}

      <section className="card">
        <h2 className="page__title">
          {editingReport ? `Edit Report - ${editingReport.client}` : 'Create New Report'}
        </h2>
        <DailyReportsForm
          existingClients={clients}
          onSubmit={handleSubmit}
          onError={handleError}
          initialReport={editingReport}
        />
        {editingReport && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setEditingReport(null)}
            style={{ marginTop: '1rem' }}
          >
            Cancel editing
          </button>
        )}
      </section>

      <section className="card">
        <h2 className="page__title">Previous Daily Reports</h2>

        <div className="reports-controls">
          <div className="search-row">
            <input
              type="text"
              placeholder="Search by client, notes, or date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-tabs">
            <button
              className={`filter-tab ${dateFilter === 'all' ? 'filter-tab--active' : ''}`}
              onClick={() => setDateFilter('all')}
            >
              All
            </button>
            <button
              className={`filter-tab ${dateFilter === 'day' ? 'filter-tab--active' : ''}`}
              onClick={() => setDateFilter('day')}
            >
              Today
            </button>
            <button
              className={`filter-tab ${dateFilter === 'week' ? 'filter-tab--active' : ''}`}
              onClick={() => setDateFilter('week')}
            >
              Last 7 days
            </button>
            <button
              className={`filter-tab ${dateFilter === 'month' ? 'filter-tab--active' : ''}`}
              onClick={() => setDateFilter('month')}
            >
              Last 30 days
            </button>
          </div>
        </div>

        {filteredReports.length === 0 ? (
          <div className="empty-state">
            <p>No reports match your search or filter criteria.</p>
          </div>
        ) : (
          <>
            <p className="reports-count">Found {filteredReports.length} report{filteredReports.length !== 1 ? 's' : ''}</p>
            <DailyReportsList
              reports={filteredReports}
              onEdit={setEditingReport}
              onDelete={handleDelete}
            />
          </>
        )}
      </section>
    </main>
  )
}