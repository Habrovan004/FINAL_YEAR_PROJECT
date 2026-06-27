import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, Stethoscope, MessageSquare, Users,
  Activity, LogOut, ChevronRight, Loader2, X,
} from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import './provider.css'

interface DashboardPayload {
  provider_name: string
  hospital: string
  stats: {
    total_patients: number
    attendance_rate: number | null
    attendance_total?: number
    attendance_attended?: number
    adherence_rate: number
    pending_alerts: number
  }
  appointments: {
    upcoming_count: number
    missed_count: number
    today: { id: number; patient: string; time: string; type: string }[]
  }
  critical_alerts: {
    id: number;
    type: 'symptom' | 'sos' | 'anc_visit';
    patient: string;
    risk?: string;
    location?: string;
    reasons?: string[];
    time: string;
  }[]
}

interface ChatQueueRow {
  id: number
  mother_name: string
  type: string
  escalated_at: string | null
  updated_at: string
  last_message?: string
  last_message_sender?: 'mother' | 'chatbot' | 'provider' | null
}

interface PatientRow {
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

interface ANCSaveResponse {
  id: number
  risk_level: 'low' | 'medium' | 'high'
  risk_reasons: string[]
}

function extractApiError(e: any, fallback: string): string {
  // Network failure / server unreachable — axios sets e.request but no e.response
  if (e?.request && !e?.response) {
    return 'Network error — cannot reach the server. Check your connection and that the backend is running.'
  }
  const data = e?.response?.data
  if (typeof data === 'string' && data.trim()) return data
  if (data && typeof data === 'object') {
    // DRF default error shape
    if (typeof data.error === 'string') return data.error
    if (typeof data.detail === 'string') return data.detail
    // Validation errors: { field: ["msg", ...] | "msg" }
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

export default function ProviderDashboard() {
  const nav = useNavigate()
  const { user, logout } = useAuth()
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [chatQueue, setChatQueue] = useState<ChatQueueRow[]>([])
  const [patients, setPatients] = useState<PatientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const [ancOpen, setAncOpen] = useState(false)
  const [ancForm, setAncForm] = useState<ANCForm>(EMPTY_ANC)
  const [ancSaving, setAncSaving] = useState(false)

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    setErr('')
    try {
      const [dash, queue, pats] = await Promise.all([
        api.get('/auth/provider/dashboard/'),
        api.get('/chatbot/provider/queue/'),
        api.get<PatientRow[]>('/patients/'),
      ])
      setData(dash.data)
      setChatQueue(queue.data)
      setPatients(pats.data)
    } catch (e: any) {
      setErr(extractApiError(e, 'Failed to load dashboard'))
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    const id = window.setInterval(() => { void load(true) }, 30000)
    return () => window.clearInterval(id)
  }, [])

  const submitAnc = async () => {
    if (!ancForm.patient_id) { alert('Enter the patient ID.'); return }
    if (!ancForm.weight_kg || !ancForm.blood_pressure_systolic || !ancForm.blood_pressure_diastolic || !ancForm.gestational_age_weeks) {
      alert('Weight, BP and gestational age are required.'); return
    }
    setAncSaving(true)
    try {
      const numOrNull = (v: string) => (v === '' || v == null ? null : Number(v))
      const payload: Record<string, unknown> = {
        patient: parseInt(ancForm.patient_id),
        weight_kg: parseFloat(ancForm.weight_kg),
        blood_pressure_systolic: parseInt(ancForm.blood_pressure_systolic),
        blood_pressure_diastolic: parseInt(ancForm.blood_pressure_diastolic),
        gestational_age_weeks: parseInt(ancForm.gestational_age_weeks),
        fundal_height_cm: numOrNull(ancForm.fundal_height_cm),
        fetal_heart_rate_bpm: numOrNull(ancForm.fetal_heart_rate_bpm),
        is_multiple_pregnancy: ancForm.is_multiple_pregnancy,
        urine_protein: ancForm.urine_protein,
        urine_glucose: ancForm.urine_glucose,
        hemoglobin_g_dl: numOrNull(ancForm.hemoglobin_g_dl),
        blood_group: ancForm.blood_group,
        hiv_status: ancForm.hiv_status,
        syphilis_status: ancForm.syphilis_status,
        complications: ancForm.complications,
        symptoms: ancForm.symptoms,
        visit_notes: ancForm.visit_notes,
        next_appointment_date: ancForm.next_appointment_date || null,
      }
      // Provider can manually override the auto risk level
      if (ancForm.risk_level !== 'auto') {
        payload.risk_level = ancForm.risk_level
        payload.risk_level_override = true
      }
      const res = await api.post<ANCSaveResponse>('/clinical/visits/', payload)
      const { risk_level, risk_reasons } = res.data
      setAncOpen(false)
      setAncForm(EMPTY_ANC)
      // Immediate refresh so high-risk patient shows up
      void load(true)
      const flagMsg = risk_level === 'high'
        ? `\n⚠ HIGH RISK flagged:\n  • ${(risk_reasons || []).join('\n  • ')}`
        : ''
      alert(`ANC visit recorded.${flagMsg}`)
    } catch (e: any) {
      alert(extractApiError(e, 'Could not save the visit.'))
    } finally {
      setAncSaving(false)
    }
  }

  const todaysAppts = data?.appointments.today || []
  const alerts = data?.critical_alerts || []
  const highRiskCount = useMemo(
    () => alerts.filter(a => (a.type === 'symptom' || a.type === 'anc_visit') && a.risk === 'high').length,
    [alerts],
  )

  if (loading) {
    return (
      <div className="provider-page flex items-center justify-center">
        <Loader2 className="animate-spin text-rose-400" size={32} />
      </div>
    )
  }

  return (
    <div className="provider-page">
      <header className="provider-header">
        <div>
          <p className="provider-eyebrow">Provider</p>
          <h1 className="provider-name">{data?.provider_name || user?.full_name}</h1>
          <p className="provider-facility">{data?.hospital || 'Facility'}</p>
        </div>
        <button onClick={() => { logout(); nav('/') }} className="provider-logout" title="Sign out">
          <LogOut size={18} />
        </button>
      </header>

      {err && <div className="provider-err">{err}</div>}

      <section className="provider-stats">
        <div className="stat-card">
          <Users size={18} className="text-rose-400" />
          <p className="stat-value">{data?.stats.total_patients ?? 0}</p>
          <p className="stat-label">Patients</p>
        </div>
        <div
          className="stat-card"
          title={
            data?.stats.attendance_rate == null
              ? 'No past appointments yet — attendance rate becomes available once visits have been recorded.'
              : `${data?.stats.attendance_attended ?? 0} of ${data?.stats.attendance_total ?? 0} past appointments attended`
          }
        >
          <Activity size={18} className="text-emerald-500" />
          <p className="stat-value">
            {data?.stats.attendance_rate == null ? '—' : `${data.stats.attendance_rate}%`}
          </p>
          <p className="stat-label">Attendance</p>
        </div>
        <div className="stat-card">
          <AlertTriangle size={18} className="text-red-500" />
          <p className="stat-value">{data?.stats.pending_alerts ?? 0}</p>
          <p className="stat-label">Pending alerts</p>
        </div>
      </section>

      {/* HIGH RISK alerts */}
      <section className="provider-section">
        <div className="provider-section-header">
          <h2><AlertTriangle size={16} className="text-red-500 inline-block mr-1" /> HIGH RISK alerts</h2>
          {highRiskCount > 0 && <span className="badge-red">{highRiskCount}</span>}
        </div>
        {alerts.length === 0 ? (
          <p className="provider-empty">No urgent alerts — all clear.</p>
        ) : alerts.map(a => {
          const isHigh = (a.type === 'symptom' || a.type === 'anc_visit') && a.risk === 'high'
          const meta = a.type === 'symptom'
            ? `Symptom report • ${a.risk?.toUpperCase() || ''}`
            : a.type === 'sos'
              ? `SOS • ${a.location || ''}`
              : `ANC visit • ${a.risk?.toUpperCase() || ''}`
          const reasonsText = (a.reasons && a.reasons.length) ? a.reasons.join(' · ') : ''
          return (
            <div key={`${a.type}-${a.id}`} className={`alert-card ${isHigh ? 'alert-high' : ''}`} title={reasonsText}>
              <div className="chat-row-body">
                <p className="alert-patient">{a.patient}</p>
                <p className="alert-meta">{meta}</p>
                {reasonsText && <p className="alert-meta chat-preview">{reasonsText}</p>}
              </div>
              <p className="alert-time">{new Date(a.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          )
        })}
      </section>

      {/* Today's appointments */}
      <section className="provider-section">
        <div className="provider-section-header">
          <h2>Today's appointments</h2>
          <span className="badge">{todaysAppts.length}</span>
        </div>
        {todaysAppts.length === 0 ? (
          <p className="provider-empty">No appointments today.</p>
        ) : todaysAppts.map(a => (
          <div key={a.id} className="appt-card">
            <div>
              <p className="alert-patient">{a.patient}</p>
              <p className="alert-meta">{a.type}</p>
            </div>
            <p className="alert-time">{a.time}</p>
          </div>
        ))}
      </section>

      {/* Live chat queue */}
      <section className="provider-section">
        <div className="provider-section-header">
          <h2><MessageSquare size={16} className="text-rose-400 inline-block mr-1" /> Live chat queue</h2>
          <span className="badge">{chatQueue.length}</span>
        </div>
        {chatQueue.length === 0 ? (
          <p className="provider-empty">No escalated chats. The bot is handling everything.</p>
        ) : chatQueue.map(c => {
          const preview = (c.last_message || '').trim()
          const senderLabel = c.last_message_sender === 'mother' ? '' : c.last_message_sender === 'chatbot' ? 'Bot: ' : ''
          const escalatedLabel = c.escalated_at
            ? `Escalated ${new Date(c.escalated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'Escalated'
          return (
            <button
              key={c.id}
              className="chat-row"
              onClick={() => nav(`/provider/chats?id=${c.id}`)}
              title={preview || escalatedLabel}
            >
              <div className="chat-row-body">
                <p className="alert-patient">{c.mother_name}</p>
                {preview && (
                  <p className="alert-meta chat-preview" title={preview}>
                    {senderLabel}{preview}
                  </p>
                )}
                <p className="alert-meta">{escalatedLabel}</p>
              </div>
              <ChevronRight size={16} className="text-rose-400" />
            </button>
          )
        })}
      </section>

      {/* Record ANC visit */}
      <button className="anc-fab" onClick={() => setAncOpen(true)}>
        <Stethoscope size={18} />
        Record ANC visit
      </button>

      {ancOpen && (
        <div className="modal-backdrop" onClick={() => setAncOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Record ANC visit</h3>
              <button onClick={() => setAncOpen(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <label className="field-label">Patient*</label>
              {patients.length === 0 ? (
                <p className="field-hint">No patients assigned to you yet. Patients are auto-assigned when they finish onboarding at your hospital.</p>
              ) : (
                <select
                  className="field-input"
                  value={ancForm.patient_id}
                  onChange={e => setAncForm({ ...ancForm, patient_id: e.target.value })}
                >
                  <option value="">— Select patient —</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} • week {p.gestational_age_weeks} • {p.risk_level.toUpperCase()}
                    </option>
                  ))}
                </select>
              )}

              <p className="field-section">Vitals</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="field-label">Weight (kg)*</label>
                  <input className="field-input" type="number" step="0.1" value={ancForm.weight_kg} onChange={e => setAncForm({ ...ancForm, weight_kg: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Gestational age (wk)*</label>
                  <input className="field-input" type="number" value={ancForm.gestational_age_weeks} onChange={e => setAncForm({ ...ancForm, gestational_age_weeks: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">BP systolic*</label>
                  <input className="field-input" type="number" value={ancForm.blood_pressure_systolic} onChange={e => setAncForm({ ...ancForm, blood_pressure_systolic: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">BP diastolic*</label>
                  <input className="field-input" type="number" value={ancForm.blood_pressure_diastolic} onChange={e => setAncForm({ ...ancForm, blood_pressure_diastolic: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Fundal height (cm)</label>
                  <input className="field-input" type="number" step="0.1" value={ancForm.fundal_height_cm} onChange={e => setAncForm({ ...ancForm, fundal_height_cm: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Fetal heart rate (bpm)</label>
                  <input className="field-input" type="number" value={ancForm.fetal_heart_rate_bpm} onChange={e => setAncForm({ ...ancForm, fetal_heart_rate_bpm: e.target.value })} />
                </div>
              </div>

              <label className="field-checkbox">
                <input type="checkbox" checked={ancForm.is_multiple_pregnancy} onChange={e => setAncForm({ ...ancForm, is_multiple_pregnancy: e.target.checked })} />
                Multiple pregnancy (twins/triplets)
              </label>

              <p className="field-section">Urine test</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="field-label">Protein</label>
                  <select className="field-input" value={ancForm.urine_protein} onChange={e => setAncForm({ ...ancForm, urine_protein: e.target.value })}>
                    <option value="not_tested">Not tested</option>
                    <option value="negative">Negative</option>
                    <option value="trace">Trace</option>
                    <option value="1+">1+</option>
                    <option value="2+">2+</option>
                    <option value="3+">3+</option>
                    <option value="4+">4+</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Glucose</label>
                  <select className="field-input" value={ancForm.urine_glucose} onChange={e => setAncForm({ ...ancForm, urine_glucose: e.target.value })}>
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

              <p className="field-section">Blood test</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="field-label">Hemoglobin (g/dL)</label>
                  <input className="field-input" type="number" step="0.1" value={ancForm.hemoglobin_g_dl} onChange={e => setAncForm({ ...ancForm, hemoglobin_g_dl: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Blood group</label>
                  <select className="field-input" value={ancForm.blood_group} onChange={e => setAncForm({ ...ancForm, blood_group: e.target.value })}>
                    <option value="unknown">Unknown</option>
                    <option value="A+">A+</option><option value="A-">A-</option>
                    <option value="B+">B+</option><option value="B-">B-</option>
                    <option value="AB+">AB+</option><option value="AB-">AB-</option>
                    <option value="O+">O+</option><option value="O-">O-</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">HIV status</label>
                  <select className="field-input" value={ancForm.hiv_status} onChange={e => setAncForm({ ...ancForm, hiv_status: e.target.value })}>
                    <option value="unknown">Unknown / not tested</option>
                    <option value="negative">Negative</option>
                    <option value="positive">Positive</option>
                    <option value="on_treatment">Positive — on ART</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Syphilis status</label>
                  <select className="field-input" value={ancForm.syphilis_status} onChange={e => setAncForm({ ...ancForm, syphilis_status: e.target.value })}>
                    <option value="unknown">Unknown / not tested</option>
                    <option value="negative">Negative</option>
                    <option value="positive">Positive</option>
                    <option value="treated">Treated</option>
                  </select>
                </div>
              </div>

              <p className="field-section">Clinical</p>
              <label className="field-label">Complications</label>
              <select className="field-input" value={ancForm.complications} onChange={e => setAncForm({ ...ancForm, complications: e.target.value })}>
                <option value="none">None</option>
                <option value="hypertension">Hypertension</option>
                <option value="diabetes">Gestational diabetes</option>
                <option value="anemia">Anemia</option>
                <option value="swelling">Severe swelling</option>
                <option value="other">Other</option>
              </select>

              <label className="field-label">Mother's symptoms / complaints</label>
              <textarea className="field-input" rows={2} value={ancForm.symptoms}
                placeholder="e.g. severe headache, blurred vision, reduced fetal movement…"
                onChange={e => setAncForm({ ...ancForm, symptoms: e.target.value })} />

              <label className="field-label">Provider notes</label>
              <textarea className="field-input" rows={3} value={ancForm.visit_notes} onChange={e => setAncForm({ ...ancForm, visit_notes: e.target.value })} />

              <label className="field-label">Next appointment date</label>
              <input className="field-input" type="date" value={ancForm.next_appointment_date} onChange={e => setAncForm({ ...ancForm, next_appointment_date: e.target.value })} />

              <label className="field-label">Risk level</label>
              <select className="field-input" value={ancForm.risk_level} onChange={e => setAncForm({ ...ancForm, risk_level: e.target.value })}>
                <option value="auto">Auto-detect (recommended)</option>
                <option value="low">Override → Low</option>
                <option value="medium">Override → Medium</option>
                <option value="high">Override → High</option>
              </select>

              <button
                className="btn-primary mt-2"
                disabled={ancSaving || patients.length === 0 || !ancForm.patient_id}
                onClick={submitAnc}
              >
                {ancSaving ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Save visit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
