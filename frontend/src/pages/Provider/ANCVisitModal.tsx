import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, X, AlertCircle, Search, Lock } from 'lucide-react'
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
  risk_level_override_reason: string
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
  risk_level_override_reason: '',
}

export interface ANCSaveResponse {
  id: number
  patient: number
  patient_name: string
  risk_level: 'low' | 'medium' | 'high'
  risk_reasons: string[]
}

interface ANCVisitModalProps {
  open: boolean
  patients: PatientRow[]
  preselectedPatientId?: number
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

// ── Local draft persistence (per mother) ────────────────────────────────────
const DRAFT_PREFIX = 'mimba_anc_draft_'
const DRAFT_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000 // 3 days

interface StoredDraft {
  form: ANCForm
  savedAt: number
}

const draftKey = (patientId: number | string) => `${DRAFT_PREFIX}${patientId}`

function readDraft(patientId: number): StoredDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(patientId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.form || typeof parsed.savedAt !== 'number') return null
    if (Date.now() - parsed.savedAt > DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(draftKey(patientId))
      return null
    }
    return parsed as StoredDraft
  } catch {
    return null
  }
}

function writeDraft(patientId: number | string, form: ANCForm) {
  try {
    localStorage.setItem(draftKey(patientId), JSON.stringify({ form, savedAt: Date.now() }))
  } catch {
    // best-effort only — storage may be full or unavailable
  }
}

function clearDraft(patientId: number | string) {
  try {
    localStorage.removeItem(draftKey(patientId))
  } catch {
    // ignore
  }
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

const patientLabel = (p: PatientRow) => `${p.full_name} · ${p.phone_number}`

export default function ANCVisitModal({ open, patients, preselectedPatientId, onClose, onSaved }: ANCVisitModalProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<ANCForm>(EMPTY_ANC)
  const [saving, setSaving] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [serverError, setServerError] = useState('')
  const [activeSection, setActiveSection] = useState<SectionKey>('vitals')

  // Typeahead patient picker
  const [selectedPatient, setSelectedPatient] = useState<PatientRow | null>(null)
  const [patientQuery, setPatientQuery] = useState('')
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false)
  const [patientResults, setPatientResults] = useState<PatientRow[]>([])
  const [searchingPatients, setSearchingPatients] = useState(false)
  const patientFieldRef = useRef<HTMLDivElement | null>(null)

  // Draft resume prompt
  const [pendingDraft, setPendingDraft] = useState<StoredDraft | null>(null)

  const bodyRef = useRef<HTMLDivElement | null>(null)
  const sectionRefs = useRef<Record<SectionKey, HTMLDivElement | null>>({
    vitals: null, tests: null, clinical: null, summary: null,
  })

  const isLocked = preselectedPatientId != null && Boolean(selectedPatient)

  const applyServerPrefill = async (patient: PatientRow) => {
    setField('gestational_age_weeks', patient.gestational_age_weeks != null ? String(patient.gestational_age_weeks) : '')
    try {
      const res = await api.get(`/clinical/summary/${patient.id}/`)
      const last = res.data?.last_visit
      if (last) {
        setForm(prev => ({
          ...prev,
          blood_group: last.blood_group ?? prev.blood_group,
          hiv_status: last.hiv_status ?? prev.hiv_status,
          syphilis_status: last.syphilis_status ?? prev.syphilis_status,
        }))
      }
    } catch {
      // Non-fatal — provider can still fill these in manually
    }
  }

  const choosePatient = (patient: PatientRow) => {
    setSelectedPatient(patient)
    setField('patient_id', String(patient.id))
    setPatientQuery(patientLabel(patient))
    setPatientDropdownOpen(false)
    const draft = readDraft(patient.id)
    if (draft) {
      setPendingDraft(draft)
    } else {
      setPendingDraft(null)
      void applyServerPrefill(patient)
    }
  }

  // Reset / initialize when the modal opens
  useEffect(() => {
    if (!open) return
    setForm(EMPTY_ANC)
    setSubmitAttempted(false)
    setServerError('')
    setActiveSection('vitals')
    setPatientDropdownOpen(false)
    setPatientResults([])
    setPendingDraft(null)

    if (preselectedPatientId != null) {
      const p = patients.find(pp => pp.id === preselectedPatientId) ?? null
      setSelectedPatient(p)
      setPatientQuery(p ? patientLabel(p) : '')
      if (p) {
        setField('patient_id', String(p.id))
        const draft = readDraft(p.id)
        if (draft) {
          setPendingDraft(draft)
        } else {
          void applyServerPrefill(p)
        }
      }
    } else {
      setSelectedPatient(null)
      setPatientQuery('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselectedPatientId])

  // Typeahead search (debounced) — skip while the query still matches the selection
  useEffect(() => {
    if (!open || !patientDropdownOpen) return
    if (selectedPatient && patientQuery === patientLabel(selectedPatient)) return
    const q = patientQuery.trim()
    if (!q) {
      setPatientResults(patients)
      setSearchingPatients(false)
      return
    }
    setSearchingPatients(true)
    const id = window.setTimeout(() => {
      api.get<PatientRow[]>('/patients/', { params: { search: q } })
        .then(res => setPatientResults(res.data))
        .catch(() => setPatientResults([]))
        .finally(() => setSearchingPatients(false))
    }, 300)
    return () => window.clearTimeout(id)
  }, [patientQuery, patientDropdownOpen, open, patients, selectedPatient])

  // Close the dropdown on outside click
  useEffect(() => {
    if (!patientDropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (patientFieldRef.current && !patientFieldRef.current.contains(e.target as Node)) {
        setPatientDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [patientDropdownOpen])

  // Persist in-progress form state locally, per mother, so an accidental close
  // or network failure doesn't lose the provider's work.
  useEffect(() => {
    if (!open || !form.patient_id || pendingDraft) return
    const id = window.setTimeout(() => writeDraft(form.patient_id, form), 400)
    return () => window.clearTimeout(id)
  }, [form, open, pendingDraft])

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
    if (form.risk_level !== 'auto' && !form.risk_level_override_reason.trim()) {
      e.risk_level_override_reason = t('provider_anc_override_reason_required')
    }
    return e
  }, [form, t])

  const setField = <K extends keyof ANCForm>(key: K, value: ANCForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const resumeDraft = () => {
    if (!pendingDraft) return
    setForm(pendingDraft.form)
    setPendingDraft(null)
  }

  const discardDraft = () => {
    if (selectedPatient) clearDraft(selectedPatient.id)
    setPendingDraft(null)
    if (selectedPatient) void applyServerPrefill(selectedPatient)
  }

  const scrollToSection = (key: SectionKey) => {
    const body = bodyRef.current
    const el = sectionRefs.current[key]
    if (!body || !el) return
    body.scrollTo({ top: el.offsetTop - body.offsetTop - 8, behavior: 'smooth' })
  }

  const submit = async () => {
    setSubmitAttempted(true)
    if (Object.keys(errors).length > 0) {
      setServerError('Please fill in the required fields before saving.')
      if (errors.patient_id || errors.weight_kg || errors.gestational_age_weeks
        || errors.blood_pressure_systolic || errors.blood_pressure_diastolic) {
        scrollToSection('vitals')
      } else if (errors.risk_level_override_reason) {
        scrollToSection('summary')
      }
      return
    }
    setServerError('')
    setSaving(true)
    try {
      const numOrNull = (v: string) => (v === '' || v == null ? null : Number(v))
      const intOrNull = (v: string) => (v === '' || v == null ? null : Math.round(Number(v)))
      const payload: Record<string, unknown> = {
        patient: parseInt(form.patient_id),
        weight_kg: parseFloat(form.weight_kg),
        blood_pressure_systolic: parseInt(form.blood_pressure_systolic),
        blood_pressure_diastolic: parseInt(form.blood_pressure_diastolic),
        gestational_age_weeks: parseInt(form.gestational_age_weeks),
        fundal_height_cm: numOrNull(form.fundal_height_cm),
        // fetal_heart_rate_bpm is an IntegerField on the backend — the number
        // input has no step restriction, so a decimal like "140.5" typed here
        // would otherwise be sent as a float and rejected with a raw DRF error.
        fetal_heart_rate_bpm: intOrNull(form.fetal_heart_rate_bpm),
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
        payload.risk_level_override_reason = form.risk_level_override_reason
      }
      const res = await api.post<ANCSaveResponse>('/clinical/visits/', payload)
      clearDraft(form.patient_id)
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

          {pendingDraft && (
            <div className="anc-draft-banner" role="alert">
              <div>
                <p className="anc-draft-banner-title">{t('provider_anc_resume_draft_title')}</p>
                <p className="anc-draft-banner-body">{t('provider_anc_resume_draft_body')}</p>
              </div>
              <div className="anc-draft-banner-actions">
                <button type="button" onClick={discardDraft} className="anc-draft-discard">
                  {t('provider_anc_discard_draft')}
                </button>
                <button type="button" onClick={resumeDraft} className="anc-draft-resume">
                  {t('provider_anc_resume')}
                </button>
              </div>
            </div>
          )}

          {/* PATIENT */}
          <div className="anc-field-row" ref={patientFieldRef}>
            <label htmlFor="anc-patient" className="anc-label">Patient<span className="req">*</span></label>
            {patients.length === 0 && !isLocked ? (
              <p className="anc-hint">
                No patients assigned to you yet. Patients are auto-assigned when
                they finish onboarding at your hospital.
              </p>
            ) : isLocked && selectedPatient ? (
              <div className="anc-locked-patient">
                <Lock size={13} />
                <span>{patientLabel(selectedPatient)} · wk {selectedPatient.gestational_age_weeks} · {selectedPatient.risk_level.toUpperCase()}</span>
              </div>
            ) : (
              <div className="anc-typeahead">
                <div className="anc-typeahead-input-wrap">
                  <Search size={14} className="anc-typeahead-icon" />
                  <input
                    id="anc-patient"
                    type="text"
                    autoComplete="off"
                    className={inputClass('patient_id')}
                    style={{ paddingLeft: 32 }}
                    placeholder={t('provider_anc_search_patient') ?? undefined}
                    value={patientQuery}
                    onFocus={() => { setPatientDropdownOpen(true); if (!patientQuery.trim()) setPatientResults(patients) }}
                    onChange={e => {
                      setPatientQuery(e.target.value)
                      setPatientDropdownOpen(true)
                      if (selectedPatient && e.target.value !== patientLabel(selectedPatient)) {
                        setSelectedPatient(null)
                        setField('patient_id', '')
                      }
                    }}
                  />
                </div>
                {patientDropdownOpen && (
                  <div className="anc-typeahead-dropdown">
                    {searchingPatients ? (
                      <div className="anc-typeahead-empty">
                        <Loader2 className="anc-spin" size={14} /> {t('provider_anc_searching')}
                      </div>
                    ) : patientResults.length === 0 ? (
                      <div className="anc-typeahead-empty">{t('provider_anc_no_results')}</div>
                    ) : (
                      patientResults.map(p => (
                        <button
                          type="button"
                          key={p.id}
                          className="anc-typeahead-option"
                          onClick={() => choosePatient(p)}
                        >
                          <span className="anc-typeahead-option-name">{p.full_name}</span>
                          <span className="anc-typeahead-option-meta">
                            {p.phone_number} · wk {p.gestational_age_weeks} · {p.risk_level.toUpperCase()}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
                {showErr('patient_id') && (
                  <p className="anc-error-text">{errors.patient_id}</p>
                )}
              </div>
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
                  step="1"
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
                  step="1"
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
                  step="1"
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
                  step="1"
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

            {form.risk_level !== 'auto' && (
              <div className="anc-field-row">
                <label htmlFor="anc-override-reason" className="anc-label">
                  {t('provider_anc_override_reason_label')}<span className="req">*</span>
                </label>
                <textarea
                  id="anc-override-reason"
                  className={inputClass('risk_level_override_reason')}
                  rows={2}
                  placeholder={t('provider_anc_override_reason_placeholder') ?? undefined}
                  value={form.risk_level_override_reason}
                  onChange={e => setField('risk_level_override_reason', e.target.value)}
                />
                {showErr('risk_level_override_reason') && (
                  <p className="anc-error-text">{errors.risk_level_override_reason}</p>
                )}
              </div>
            )}

            <button
              type="button"
              className="anc-save-btn"
              disabled={saving || (patients.length === 0 && !isLocked)}
              onClick={submit}
            >
              {saving ? (
                <Loader2 className="anc-spin" size={16} />
              ) : submitAttempted && serverError ? (
                t('provider_anc_retry_save')
              ) : (
                'Save visit'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
