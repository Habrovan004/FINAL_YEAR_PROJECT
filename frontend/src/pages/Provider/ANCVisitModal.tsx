import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, X, AlertCircle } from 'lucide-react'
import api from '../../api/client'

export interface PatientRow {
  id: number
  full_name: string
  phone_number: string
  gestational_age_weeks: number
  trimester: string
  risk_level: 'low' | 'medium' | 'high'
  last_visit_date: string | null
}

interface ANCForm {
  patient_id: string
  weight_kg: string
  blood_pressure_systolic: string
  blood_pressure_diastolic: string
  gestational_age_weeks: string
  fundal_height_cm: string
  fetal_heart_rate_bpm: string
  is_multiple_pregnancy: boolean
  urine_protein: string
  urine_glucose: string
  hemoglobin_g_dl: string
  blood_group: string
  hiv_status: string
  syphilis_status: string
  complications: string
  symptoms: string
  visit_notes: string
  next_appointment_date: string
  risk_level: string
  risk_level_override: boolean
}

const EMPTY_ANC: ANCForm = {
  patient_id: '', weight_kg: '', blood_pressure_systolic: '',
  blood_pressure_diastolic: '', gestational_age_weeks: '',
  fundal_height_cm: '', fetal_heart_rate_bpm: '',
  is_multiple_pregnancy: false,
  urine_protein: 'not_tested', urine_glucose: 'not_tested',
  hemoglobin_g_dl: '', blood_group: 'unknown',
  hiv_status: 'unknown', syphilis_status: 'unknown',
  complications: 'none', symptoms: '', visit_notes: '',
  next_appointment_date: '',
  risk_level: 'auto', risk_level_override: false,
}

export interface ANCSaveResponse {
  id: number
  risk_level: 'low' | 'medium' | 'high'
  risk_reasons: string[]
}

interface ANCVisitModalProps {
  open: boolean
  patients: PatientRow[]
  onClose: () => void
  onSaved: (response: ANCSaveResponse) => void
}

type SectionKey = 'vitals' | 'tests' | 'clinical' | 'summary'

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'vitals', label: 'Vitals' },
  { key: 'tests', label: 'Tests' },
  { key: 'clinical', label: 'Clinical' },
  { key: 'summary', label: 'Summary' },
]

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

export default function ANCVisitModal({ open, patients, onClose, onSaved }: ANCVisitModalProps) {
  const [form, setForm] = useState<ANCForm>(EMPTY_ANC)
  const [saving, setSaving] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [serverError, setServerError] = useState('')
  const [activeSection, setActiveSection] = useState<SectionKey>('vitals')

  const bodyRef = useRef<HTMLDivElement | null>(null)
  const sectionRefs = useRef<Record<SectionKey, HTMLDivElement | null>>({
    vitals: null, tests: null, clinical: null, summary: null,
  })

  // Reset when reopened
  useEffect(() => {
    if (open) {
      setForm(EMPTY_ANC)
      setSubmitAttempted(false)
      setServerError('')
      setActiveSection('vitals')
    }
  }, [open])

  // Track active section via scroll position
  useEffect(() => {
    if (!open) return
    const body = bodyRef.current
    if (!body) return

    const handleScroll = () => {
      const scrollTop = body.scrollTop
      const bodyHeight = body.clientHeight
      let current: SectionKey = 'vitals'
      for (const { key } of SECTIONS) {
        const el = sectionRefs.current[key]
        if (!el) continue
        const offsetTop = el.offsetTop - body.offsetTop
        if (offsetTop <= scrollTop + bodyHeight * 0.35) {
          current = key
        }
      }
      setActiveSection(current)
    }

    body.addEventListener('scroll', handleScroll, { passive: true })
    return () => body.removeEventListener('scroll', handleScroll)
  }, [open])

  const errors = useMemo(() => {
    const e: Partial<Record<keyof ANCForm, string>> = {}
    if (!form.patient_id) e.patient_id = 'Select a patient'
    if (!form.weight_kg) e.weight_kg = 'Weight is required'
    if (!form.gestational_age_weeks) e.gestational_age_weeks = 'Gestational age is required'
    if (!form.blood_pressure_systolic) e.blood_pressure_systolic = 'BP systolic is required'
    if (!form.blood_pressure_diastolic) e.blood_pressure_diastolic = 'BP diastolic is required'
    return e
  }, [form])

  const setField = <K extends keyof ANCForm>(key: K, value: ANCForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const scrollToSection = (key: SectionKey) => {
    const body = bodyRef.current
    const el = sectionRefs.current[key]
    if (!body || !el) return
    body.scrollTo({ top: el.offsetTop - body.offsetTop - 8, behavior: 'smooth' })
  }

  const submit = async () => {
    setSubmitAttempted(true)
    setServerError('')
    if (Object.keys(errors).length > 0) {
      // Scroll to first error
      if (errors.patient_id || errors.weight_kg || errors.gestational_age_weeks
        || errors.blood_pressure_systolic || errors.blood_pressure_diastolic) {
        scrollToSection('vitals')
      }
      return
    }
    setSaving(true)
    try {
      const numOrNull = (v: string) => (v === '' || v == null ? null : Number(v))
      const payload: Record<string, unknown> = {
        patient: parseInt(form.patient_id),
        weight_kg: parseFloat(form.weight_kg),
        blood_pressure_systolic: parseInt(form.blood_pressure_systolic),
        blood_pressure_diastolic: parseInt(form.blood_pressure_diastolic),
        gestational_age_weeks: parseInt(form.gestational_age_weeks),
        fundal_height_cm: numOrNull(form.fundal_height_cm),
        fetal_heart_rate_bpm: numOrNull(form.fetal_heart_rate_bpm),
        is_multiple_pregnancy: form.is_multiple_pregnancy,
        urine_protein: form.urine_protein,
        urine_glucose: form.urine_glucose,
        hemoglobin_g_dl: numOrNull(form.hemoglobin_g_dl),
        blood_group: form.blood_group,
        hiv_status: form.hiv_status,
        syphilis_status: form.syphilis_status,
        complications: form.complications,
        symptoms: form.symptoms,
        visit_notes: form.visit_notes,
        next_appointment_date: form.next_appointment_date || null,
      }
      if (form.risk_level !== 'auto') {
        payload.risk_level = form.risk_level
        payload.risk_level_override = true
      }
      const res = await api.post<ANCSaveResponse>('/clinical/visits/', payload)
      onSaved(res.data)
    } catch (e: any) {
      setServerError(extractApiError(e, 'Could not save the visit.'))
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const showErr = (k: keyof ANCForm) => submitAttempted && Boolean(errors[k])

  const inputClass = (k: keyof ANCForm) => `anc-field ${showErr(k) ? 'anc-field--error' : ''}`

  return (
    <div className="anc-modal-backdrop" onClick={onClose}>
      <div
        className="anc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="anc-modal-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="anc-modal-header">
          <h3 id="anc-modal-title">Record ANC visit</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Progress indicator (scrollable tabs) */}
        <div className="anc-progress" role="tablist" aria-label="Form sections">
          {SECTIONS.map(s => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={activeSection === s.key}
              className={`anc-progress-tab ${activeSection === s.key ? 'is-active' : ''}`}
              onClick={() => scrollToSection(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="anc-modal-body" ref={bodyRef}>
          {serverError && (
            <div className="anc-server-error" role="alert">
              <AlertCircle size={14} /> {serverError}
            </div>
          )}

          {/* PATIENT */}
          <div className="anc-field-row">
            <label htmlFor="anc-patient" className="anc-label">Patient<span className="req">*</span></label>
            {patients.length === 0 ? (
              <p className="anc-hint">
                No patients assigned to you yet. Patients are auto-assigned when
                they finish onboarding at your hospital.
              </p>
            ) : (
              <>
                <select
                  id="anc-patient"
                  className={inputClass('patient_id')}
                  value={form.patient_id}
                  onChange={e => setField('patient_id', e.target.value)}
                >
                  <option value="">— Select patient —</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} · wk {p.gestational_age_weeks} · {p.risk_level.toUpperCase()}
                    </option>
                  ))}
                </select>
                {showErr('patient_id') && (
                  <p className="anc-error-text">{errors.patient_id}</p>
                )}
              </>
            )}
          </div>

          {/* VITALS */}
          <div
            ref={el => { sectionRefs.current.vitals = el }}
            data-section="vitals"
            className="anc-section"
          >
            <p className="anc-section-title">Vitals</p>
            <div className="anc-grid-2">
              <div className="anc-field-row">
                <label htmlFor="anc-weight" className="anc-label">Weight (kg)<span className="req">*</span></label>
                <input
                  id="anc-weight"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  className={inputClass('weight_kg')}
                  value={form.weight_kg}
                  onChange={e => setField('weight_kg', e.target.value)}
                />
                {showErr('weight_kg') && <p className="anc-error-text">{errors.weight_kg}</p>}
              </div>
              <div className="anc-field-row">
                <label htmlFor="anc-ga" className="anc-label">Gestational age (wk)<span className="req">*</span></label>
                <input
                  id="anc-ga"
                  type="number"
                  inputMode="numeric"
                  className={inputClass('gestational_age_weeks')}
                  value={form.gestational_age_weeks}
                  onChange={e => setField('gestational_age_weeks', e.target.value)}
                />
                {showErr('gestational_age_weeks') && (
                  <p className="anc-error-text">{errors.gestational_age_weeks}</p>
                )}
              </div>
              <div className="anc-field-row">
                <label htmlFor="anc-sys" className="anc-label">BP systolic<span className="req">*</span></label>
                <input
                  id="anc-sys"
                  type="number"
                  inputMode="numeric"
                  className={inputClass('blood_pressure_systolic')}
                  value={form.blood_pressure_systolic}
                  onChange={e => setField('blood_pressure_systolic', e.target.value)}
                />
                {showErr('blood_pressure_systolic') && (
                  <p className="anc-error-text">{errors.blood_pressure_systolic}</p>
                )}
              </div>
              <div className="anc-field-row">
                <label htmlFor="anc-dia" className="anc-label">BP diastolic<span className="req">*</span></label>
                <input
                  id="anc-dia"
                  type="number"
                  inputMode="numeric"
                  className={inputClass('blood_pressure_diastolic')}
                  value={form.blood_pressure_diastolic}
                  onChange={e => setField('blood_pressure_diastolic', e.target.value)}
                />
                {showErr('blood_pressure_diastolic') && (
                  <p className="anc-error-text">{errors.blood_pressure_diastolic}</p>
                )}
              </div>
              <div className="anc-field-row">
                <label htmlFor="anc-fundal" className="anc-label">Fundal height (cm)</label>
                <input
                  id="anc-fundal"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  className="anc-field"
                  value={form.fundal_height_cm}
                  onChange={e => setField('fundal_height_cm', e.target.value)}
                />
              </div>
              <div className="anc-field-row">
                <label htmlFor="anc-fhr" className="anc-label">Fetal heart rate (bpm)</label>
                <input
                  id="anc-fhr"
                  type="number"
                  inputMode="numeric"
                  className="anc-field"
                  value={form.fetal_heart_rate_bpm}
                  onChange={e => setField('fetal_heart_rate_bpm', e.target.value)}
                />
              </div>
            </div>

            <label className="anc-checkbox">
              <input
                type="checkbox"
                checked={form.is_multiple_pregnancy}
                onChange={e => setField('is_multiple_pregnancy', e.target.checked)}
              />
              Multiple pregnancy (twins/triplets)
            </label>
          </div>

          {/* TESTS */}
          <div
            ref={el => { sectionRefs.current.tests = el }}
            data-section="tests"
            className="anc-section"
          >
            <p className="anc-section-title">Urine test</p>
            <div className="anc-grid-2">
              <div className="anc-field-row">
                <label className="anc-label">Protein</label>
                <select
                  className="anc-field"
                  value={form.urine_protein}
                  onChange={e => setField('urine_protein', e.target.value)}
                >
                  <option value="not_tested">Not tested</option>
                  <option value="negative">Negative</option>
                  <option value="trace">Trace</option>
                  <option value="1+">1+</option>
                  <option value="2+">2+</option>
                  <option value="3+">3+</option>
                  <option value="4+">4+</option>
                </select>
              </div>
              <div className="anc-field-row">
                <label className="anc-label">Glucose</label>
                <select
                  className="anc-field"
                  value={form.urine_glucose}
                  onChange={e => setField('urine_glucose', e.target.value)}
                >
                  <option value="not_tested">Not tested</option>
                  <option value="negative">Negative</option>
                  <option value="trace">Trace</option>
                  <option value="1+">1+</option>
                  <option value="2+">2+</option>
                  <option value="3+">3+</option>
                  <option value="4+">4+</option>
                </select>
              </div>
            </div>

            <p className="anc-section-title">Blood test</p>
            <div className="anc-grid-2">
              <div className="anc-field-row">
                <label className="anc-label">Hemoglobin (g/dL)</label>
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  className="anc-field"
                  value={form.hemoglobin_g_dl}
                  onChange={e => setField('hemoglobin_g_dl', e.target.value)}
                />
              </div>
              <div className="anc-field-row">
                <label className="anc-label">Blood group</label>
                <select
                  className="anc-field"
                  value={form.blood_group}
                  onChange={e => setField('blood_group', e.target.value)}
                >
                  <option value="unknown">Unknown</option>
                  <option value="A+">A+</option><option value="A-">A-</option>
                  <option value="B+">B+</option><option value="B-">B-</option>
                  <option value="AB+">AB+</option><option value="AB-">AB-</option>
                  <option value="O+">O+</option><option value="O-">O-</option>
                </select>
              </div>
              <div className="anc-field-row">
                <label className="anc-label">HIV status</label>
                <select
                  className="anc-field"
                  value={form.hiv_status}
                  onChange={e => setField('hiv_status', e.target.value)}
                >
                  <option value="unknown">Unknown / not tested</option>
                  <option value="negative">Negative</option>
                  <option value="positive">Positive</option>
                  <option value="on_treatment">Positive — on ART</option>
                </select>
              </div>
              <div className="anc-field-row">
                <label className="anc-label">Syphilis status</label>
                <select
                  className="anc-field"
                  value={form.syphilis_status}
                  onChange={e => setField('syphilis_status', e.target.value)}
                >
                  <option value="unknown">Unknown / not tested</option>
                  <option value="negative">Negative</option>
                  <option value="positive">Positive</option>
                  <option value="treated">Treated</option>
                </select>
              </div>
            </div>
          </div>

          {/* CLINICAL */}
          <div
            ref={el => { sectionRefs.current.clinical = el }}
            data-section="clinical"
            className="anc-section"
          >
            <p className="anc-section-title">Clinical</p>
            <div className="anc-field-row">
              <label className="anc-label">Complications</label>
              <select
                className="anc-field"
                value={form.complications}
                onChange={e => setField('complications', e.target.value)}
              >
                <option value="none">None</option>
                <option value="hypertension">Hypertension</option>
                <option value="diabetes">Gestational diabetes</option>
                <option value="anemia">Anemia</option>
                <option value="swelling">Severe swelling</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="anc-field-row">
              <label className="anc-label">Mother's symptoms / complaints</label>
              <textarea
                className="anc-field"
                rows={2}
                value={form.symptoms}
                placeholder="e.g. severe headache, blurred vision, reduced fetal movement…"
                onChange={e => setField('symptoms', e.target.value)}
              />
            </div>
            <div className="anc-field-row">
              <label className="anc-label">Provider notes</label>
              <textarea
                className="anc-field"
                rows={3}
                value={form.visit_notes}
                onChange={e => setField('visit_notes', e.target.value)}
              />
            </div>
          </div>

          {/* SUMMARY */}
          <div
            ref={el => { sectionRefs.current.summary = el }}
            data-section="summary"
            className="anc-section"
          >
            <p className="anc-section-title">Summary</p>
            <div className="anc-field-row">
              <label className="anc-label">Next appointment date</label>
              <input
                type="date"
                className="anc-field"
                value={form.next_appointment_date}
                onChange={e => setField('next_appointment_date', e.target.value)}
              />
            </div>
            <div className="anc-field-row">
              <label className="anc-label">Risk level</label>
              <select
                className="anc-field"
                value={form.risk_level}
                onChange={e => setField('risk_level', e.target.value)}
              >
                <option value="auto">Auto-detect (recommended)</option>
                <option value="low">Override → Low</option>
                <option value="medium">Override → Medium</option>
                <option value="high">Override → High</option>
              </select>
            </div>

            <button
              type="button"
              className="anc-save-btn"
              disabled={saving || patients.length === 0}
              onClick={submit}
            >
              {saving ? <Loader2 className="anc-spin" size={16} /> : 'Save visit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}