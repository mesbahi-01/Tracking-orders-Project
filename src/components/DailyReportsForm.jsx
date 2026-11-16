import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createDailyReportId } from '../lib/dailyReportsStorage'
import { ensureCustomerId } from '../territory/customerLink'
import { normalizeName } from '../territory/normalize'
import CustomerPicker from './territory/CustomerPicker'

export default function DailyReportsForm({ existingClients, onSubmit, onError, initialReport = null }) {
  const [date, setDate] = useState(initialReport?.date || '')
  const [client, setClient] = useState(initialReport?.client || '')
  const [notes, setNotes] = useState(initialReport?.notes || '')
  const [voiceNotes, setVoiceNotes] = useState(initialReport?.voiceNotes || [])
  const [currentAudio, setCurrentAudio] = useState({ url: '', name: '' })
  const [isRecording, setIsRecording] = useState(false)
  const [recordingError, setRecordingError] = useState('')
  const [picker, setPicker] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const { t } = useTranslation()

  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const streamRef = useRef(null)

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  useEffect(() => {
    if (initialReport) {
      setDate(initialReport.date || '')
      setClient(initialReport.client || '')
      setNotes(initialReport.notes || '')
      setVoiceNotes(initialReport.voiceNotes || [])
      setCurrentAudio({ url: '', name: '' })
      setRecordingError('')
    } else {
      resetForm()
    }
  }, [initialReport])

  const resetForm = () => {
    setDate('')
    setClient('')
    setNotes('')
    setVoiceNotes([])
    setCurrentAudio({ url: '', name: '' })
    setRecordingError('')
    setIsRecording(false)
  }

  const handleAudioUpload = (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const reader = new FileReader()

    reader.onloadend = () => {
      setCurrentAudio({
        url: reader.result,
        name: file.name || 'uploaded-audio'
      })
      setRecordingError('')
    }

    reader.readAsDataURL(file)
  }

  const handleStartRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') {
      setRecordingError('Audio recording is not supported in this browser.')
      onError?.('Audio recording is not supported in this browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mediaRecorder = new window.MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const reader = new FileReader()

        reader.onloadend = () => {
          setCurrentAudio({
            url: reader.result,
            name: `recording-${new Date().toISOString()}.webm`
          })
          setRecordingError('')
          setIsRecording(false)
        }

        reader.readAsDataURL(audioBlob)

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop())
          streamRef.current = null
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingError('')
    } catch (error) {
      setRecordingError('Unable to access the microphone. Please allow microphone access and try again.')
      onError?.('Unable to access the microphone.')
    }
  }

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  const addVoiceNote = () => {
    if (!currentAudio.url) {
      onError?.('Please record or upload audio before adding.')
      return
    }
    setVoiceNotes([...voiceNotes, currentAudio])
    setCurrentAudio({ url: '', name: '' })
  }

  const removeVoiceNote = (index) => {
    setVoiceNotes(voiceNotes.filter((_, i) => i !== index))
  }

  // resolves with a customer, null (new customer) or undefined (cancelled)
  const askPicker = (customers) => new Promise((resolve) => setPicker({ customers, resolve }))

  const closePicker = (result) => {
    if (picker) picker.resolve(result)
    setPicker(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!date) {
      onError?.('Please select a date.')
      return
    }

    if (!client.trim()) {
      onError?.('Please provide a client name.')
      return
    }

    if (voiceNotes.length === 0) {
      onError?.('Please add at least one voice note.')
      return
    }

    if (submitting) {
      return
    }

    const trimmedClient = client.trim()
    setSubmitting(true)
    try {
      let customerId
      if (initialReport?.customerId && normalizeName(initialReport.client || '') === normalizeName(trimmedClient)) {
        // same name as before: keep the existing link
        customerId = initialReport.customerId
      } else {
        customerId = await ensureCustomerId(trimmedClient, askPicker)
        if (!customerId) {
          return // picker cancelled
        }
      }

      await onSubmit({
        ...initialReport,
        id: initialReport?.id || createDailyReportId(),
        date,
        client: trimmedClient,
        customerId,
        notes: notes.trim(),
        voiceNotes,
        createdAt: initialReport?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })

      if (!initialReport) {
        resetForm()
      }
    } catch (error) {
      console.error('Failed to resolve customer', error)
      onError?.(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="daily-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>

        <label className="field">
          <span>Client</span>
          <input
            list="client-options"
            type="text"
            value={client}
            onChange={(event) => setClient(event.target.value)}
            placeholder="Choose an existing client or enter a new one"
          />
          <datalist id="client-options">
            {existingClients.map((existingClient) => (
              <option key={existingClient} value={existingClient} />
            ))}
          </datalist>
        </label>
      </div>

      <label className="field">
        <span>Notes</span>
        <textarea
          rows="4"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Add context for the daily report"
        />
      </label>

      <div className="field">
        <span>Voice Notes</span>
        <div className="voice-section">
          <div className="voice-controls">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={handleStartRecording}
              disabled={isRecording}
            >
              {isRecording ? 'Recording…' : 'Record audio'}
            </button>

            <button
              type="button"
              className="btn btn--secondary"
              onClick={handleStopRecording}
              disabled={!isRecording}
            >
              Stop recording
            </button>

            <label className="btn btn--secondary upload-button">
              Upload audio
              <input type="file" accept="audio/*" onChange={handleAudioUpload} />
            </label>
          </div>

          {recordingError ? <p className="field__hint field__hint--error">{recordingError}</p> : null}

          {currentAudio.url ? (
            <div className="audio-preview">
              <p className="audio-preview__title">{currentAudio.name || 'Voice note ready'}</p>
              <audio controls src={currentAudio.url} className="audio-preview__player" />
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={addVoiceNote}
                  style={{ flex: 1 }}
                >
                  Add this note
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setCurrentAudio({ url: '', name: '' })}
                >
                  Discard
                </button>
              </div>
            </div>
          ) : (
            <p className="field__hint">
              Record audio directly from your browser/device or upload an existing audio file.
            </p>
          )}

          {voiceNotes.length > 0 && (
            <div className="voice-notes-list">
              <p className="voice-notes-list__title">Added voice notes ({voiceNotes.length})</p>
              {voiceNotes.map((note, index) => (
                <div key={index} className="voice-note-item">
                  <div className="voice-note-item__header">
                    <span className="voice-note-item__name">{note.name || `Voice note ${index + 1}`}</span>
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      onClick={() => removeVoiceNote(index)}
                    >
                      Remove
                    </button>
                  </div>
                  <audio controls src={note.url} className="voice-note-item__player" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          Save Daily Report
        </button>
      </div>

      {picker && (
        <CustomerPicker
          customers={picker.customers}
          title={t('customerPicker.title')}
          onPick={closePicker}
          onCancel={() => closePicker(undefined)}
        />
      )}
    </form>
  )
}