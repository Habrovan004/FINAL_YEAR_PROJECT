import { useEffect, useMemo, useState } from 'react'
import { Loader2, X, AlertCircle } from 'lucide-react'
import api from '../../api/client'
import type { PatientRow } from './ANCVisitModal'

const VISIT_TYPES: { value: string; label: string }[] = [
  { value: 'anc', label: 'ANC Routine Check-up' },
  { value: 'ultrasound', label: 'Ultrasound Scan' },
  { value: 'blood_test', label: 'Blood Test' },
  { value: 'consultation', label: 'Doctor Consultation' },
  { value: 'other', label: 'Other' },
]

interface ScheduleForm {
  patient_id: string
  visit_type: string
  appointment_date: string
  appointment_time: string
  notes: string
}

const EMPTY_FORM: ScheduleForm = {
  patient_id: '', visit_type: 'anc', appointment_date: '', appointment_time: '', notes: '',
}

export interface AppointmentSaveResponse {
  id: number
  patient_name: string
  appointment_date: string
  appointment_time: string
}

interface ScheduleAppointmentModalProps {
  open: boolean
  patients: PatientRow[]
  onClose: () => void
  onSaved: (response: AppointmentSaveResponse) => void
}

function extractApiError(e: any, fallback: string): string {
  if (e?.request && !e?.response) {
    return 'Network error — cannot reach the server. Check your connection and that the backend is running.'
  }
  const data = e?.response?.data
  if (typeof data === 'string' && data.trim()) return data
  if (data && typeof data === 'object') {
    if (typeof data.error === 'string') return data.error
    if (typeof data.detail === 'string') return data.detail
    const parts = Object.entries(data)
      .map(([k, v]) => {
        const text = Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? v : JSON.stringify(v)
        return text ? `${k}: ${text}` : ''
      })
      .filter(Boolean)
    if (parts.length) return parts.join('\n')
  }
  if (e?.message) return `${fallback} (${e.message})`
  return fallback
}

const todayIso = () => new Date().toISOString().slice(0, 10)

export default function ScheduleAppointmentModal({ open, patients, onClose, onSaved }: ScheduleAppointmentModalProps) {
  const [form, setForm] = useState<ScheduleForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [serverError, setServerError] = useState('')

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM)
      setSubmitAttempted(false)
      setServerError('')
    }
  }, [open])

  const errors = useMemo(() => {
    const e: Partial<Record<keyof ScheduleForm, string>> = {}
    if (!form.patient_id) e.patient_id = 'Select a mother'
    if (!form.appointment_date) e.appointment_date = 'Date is required'
    else if (form.appointment_date < todayIso()) e.appointment_date = 'Date cannot be in the past'
    if (!form.appointment_time) e.appointment_time = 'Time is required'
    return e
  }, [form])

  const setField = <K extends keyof ScheduleForm>(key: K, value: ScheduleForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const submit = async () => {
    setSubmitAttempted(true)
    setServerError('')
    if (Object.keys(errors).length > 0) return
    setSaving(true)
    try {
      const res = await api.post<AppointmentSaveResponse>('/appointments/', {
        patient_id: parseInt(form.patient_id),
        visit_type: form.visit_type,
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time,
        notes: form.notes,
      })
      onSaved(res.data)
    } catch (e: any) {
      setServerError(extractApiError(e, 'Could not schedule the appointment.'))
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const showErr = (k: keyof ScheduleForm) => submitAttempted && Boolean(errors[k])
  const inputClass = (k: keyof ScheduleForm) => `anc-field ${showErr(k) ? 'anc-field--error' : ''}`

  return (
    <div className="anc-modal-backdrop" onClick={onClose}>
      <div
        className="anc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-modal-title"
        style={{ maxHeight: 'min(560px, 88vh)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="anc-modal-header">
          <h3 id="schedule-modal-title">Schedule appointment</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="anc-modal-body">
          {serverError && (
            <div className="anc-server-error" role="alert">
              <AlertCircle size={14} /> {serverError}
            </div>
          )}

          <div className="anc-field-row">
            <label htmlFor="sched-patient" className="anc-label">Mother<span className="req">*</span></label>
            {patients.length === 0 ? (
              <p className="anc-hint">
                No patients assigned to you yet. Patients are auto-assigned when
                they finish onboarding at your hospital.
              </p>
            ) : (
              <>
                <select
                  id="sched-patient"
                  className={inputClass('patient_id')}
                  value={form.patient_id}
                  onChange={e => setField('patient_id', e.target.value)}
                >
                  <option value="">— Select mother —</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} · wk {p.gestational_age_weeks} · {p.risk_level.toUpperCase()}
                    </option>
                  ))}
                </select>
                {showErr('patient_id') && <p className="anc-error-text">{errors.patient_id}</p>}
              </>
            )}
          </div>

          <div className="anc-field-row">
            <label htmlFor="sched-type" className="anc-label">Visit type</label>
            <select
              id="sched-type"
              className="anc-field"
              value={form.visit_type}
              onChange={e => setField('visit_type', e.target.value)}
            >
              {VISIT_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>

          <div className="anc-grid-2">
            <div className="anc-field-row">
              <label htmlFor="sched-date" className="anc-label">Date<span className="req">*</span></label>
              <input
                id="sched-date"
                type="date"
                min={todayIso()}
                className={inputClass('appointment_date')}
                value={form.appointment_date}
                onChange={e => setField('appointment_date', e.target.value)}
              />
              {showErr('appointment_date') && <p className="anc-error-text">{errors.appointment_date}</p>}
            </div>
            <div className="anc-field-row">
              <label htmlFor="sched-time" className="anc-label">Time<span className="req">*</span></label>
              <input
                id="sched-time"
                type="time"
                className={inputClass('appointment_time')}
                value={form.appointment_time}
                onChange={e => setField('appointment_time', e.target.value)}
              />
              {showErr('appointment_time') && <p className="anc-error-text">{errors.appointment_time}</p>}
            </div>
          </div>

          <div className="anc-field-row">
            <label htmlFor="sched-notes" className="anc-label">Notes for the mother (optional)</label>
            <textarea
              id="sched-notes"
              className="anc-field"
              rows={3}
              value={form.notes}
              placeholder="e.g. bring previous ANC card, fast for 8 hours…"
              onChange={e => setField('notes', e.target.value)}
            />
          </div>

          <button
            type="button"
            className="anc-save-btn"
            disabled={saving || patients.length === 0}
            onClick={submit}
          >
            {saving ? <Loader2 className="anc-spin" size={16} /> : 'Schedule appointment'}
          </button>
        </div>
      </div>
    </div>
  )
}
