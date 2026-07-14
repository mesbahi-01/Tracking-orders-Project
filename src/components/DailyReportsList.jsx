import React from 'react'
import { formatDisplayDate } from '../lib/dailyReportsStorage'

export default function DailyReportsList({ reports, onEdit, onDelete }) {
  const sortedReports = [...reports].sort((first, second) => {
    return new Date(second.date) - new Date(first.date)
  })

  return (
    <section className="reports-section">
      <h2 className="reports-section__title">Previous Daily Reports</h2>

      {sortedReports.length === 0 ? (
        <div className="empty-state">
          <p>No reports have been created yet.</p>
        </div>
      ) : (
        <ul className="report-list">
          {sortedReports.map((report) => (
            <li key={report.id} className="report-card">
              <div className="report-card__header">
                <h3>{report.client}</h3>
                <span>{formatDisplayDate(report.date)}</span>
              </div>

              {report.notes ? <p className="report-card__notes">{report.notes}</p> : null}

              {report.voiceNotes && report.voiceNotes.length > 0 ? (
                <div className="report-card__audio-list">
                  <p className="report-card__audio-label">Voice notes ({report.voiceNotes.length})</p>
                  {report.voiceNotes.map((audioNote, index) => (
                    <div key={index} className="report-card__audio-item">
                      <span className="report-card__audio-name">{audioNote.name || `Voice note ${index + 1}`}</span>
                      <audio controls src={audioNote.url} />
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="report-card__meta">
                <span>Created {formatDisplayDate(report.createdAt)}</span>
                {report.updatedAt && report.updatedAt !== report.createdAt && (
                  <span>• Updated {formatDisplayDate(report.updatedAt)}</span>
                )}
              </div>

              <div className="report-card__actions">
                <button
                  type="button"
                  className="btn btn--secondary btn--small"
                  onClick={() => onEdit?.(report)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() => onDelete?.(report.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}