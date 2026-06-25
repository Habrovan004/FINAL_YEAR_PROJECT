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
    attendance_rate: number
    adherence_rate: number
    pending_alerts: number
  }
  appointments: {
    upcoming_count: number
    missed_count: number
    today: { id: number; patient: string; time: string; type: string }[]
  }
  critical_alerts: {
    id: number; type: 'symptom' | 'sos'; patient: string;
    risk?: string; location?: string; time: string
  }[]
}

interface ChatQueueRow {
  id: number
  mother_name: string
  type: string
  escalated_at: string | null
  updated_at: string
}

interface ANCForm {
  patient_id: string
  weight_kg: string
  blood_pressure_systolic: string
  blood_pressure_diastolic: string
  gestational_age_weeks: string
  complications: string
  visit_notes: string
}

const EMPTY_ANC: ANCForm = {
  patient_id: '', weight_kg: '', blood_pressure_systolic: '',
  blood_pressure_diastolic: '', gestational_age_weeks: '',
  complications: 'none', visit_notes: '',
}

export default function ProviderDashboard() {
  const nav = useNavigate()
  const { user, logout } = useAuth()
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [chatQueue, setChatQueue] = useState<ChatQueueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const [ancOpen, setAncOpen] = useState(false)
  const [ancForm, setAncForm] = useState<ANCForm>(EMPTY_ANC)
  const [ancSaving, setAncSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    setErr('')
    try {
      const [dash, queue] = await Promise.all([
        api.get('/auth/provider/dashboard/'),
        api.get('/chatbot/provider/queue/'),
      ])
      setData(dash.data)
      setChatQueue(queue.data)
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const submitAnc = async () => {
    if (!ancForm.patient_id) { alert('Enter the patient ID.'); return }
    setAncSaving(true)
    try {
      await api.post('/clinical/visits/', {
        patient: parseInt(ancForm.patient_id),
        weight_kg: parseFloat(ancForm.weight_kg || '0'),
        blood_pressure_systolic: parseInt(ancForm.blood_pressure_systolic || '0'),
        blood_pressure_diastolic: parseInt(ancForm.blood_pressure_diastolic || '0'),
        gestational_age_weeks: parseInt(ancForm.gestational_age_weeks || '0'),
        complications: ancForm.complications,
        visit_notes: ancForm.visit_notes,
      })
      setAncOpen(false)
      setAncForm(EMPTY_ANC)
      alert('ANC visit recorded.')
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not save the visit')
    } finally {
      setAncSaving(false)
    }
  }

  const todaysAppts = data?.appointments.today || []
  const alerts = data?.critical_alerts || []
  const highRiskCount = useMemo(
    () => alerts.filter(a => a.type === 'symptom' && a.risk === 'high').length,
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
        <div className="stat-card">
          <Activity size={18} className="text-emerald-500" />
          <p className="stat-value">{data?.stats.attendance_rate ?? 0}%</p>
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
        ) : alerts.map(a => (
          <div key={`${a.type}-${a.id}`} className={`alert-card ${a.type === 'symptom' && a.risk === 'high' ? 'alert-high' : ''}`}>
            <div>
              <p className="alert-patient">{a.patient}</p>
              <p className="alert-meta">
                {a.type === 'symptom' ? `Symptom report • ${a.risk?.toUpperCase()}` : `SOS • ${a.location}`}
              </p>
            </div>
            <p className="alert-time">{new Date(a.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        ))}
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
        ) : chatQueue.map(c => (
          <button key={c.id} className="chat-row" onClick={() => nav(`/provider/chats?id=${c.id}`)}>
            <div>
              <p className="alert-patient">{c.mother_name}</p>
              <p className="alert-meta">Escalated {c.escalated_at ? new Date(c.escalated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</p>
            </div>
            <ChevronRight size={16} className="text-rose-400" />
          </button>
        ))}
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
              <label className="field-label">Patient ID (user ID)</label>
              <input className="field-input" value={ancForm.patient_id} onChange={e => setAncForm({ ...ancForm, patient_id: e.target.value })} placeholder="e.g. 3" />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="field-label">Weight (kg)</label>
                  <input className="field-input" type="number" value={ancForm.weight_kg} onChange={e => setAncForm({ ...ancForm, weight_kg: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Gestational age (wk)</label>
                  <input className="field-input" type="number" value={ancForm.gestational_age_weeks} onChange={e => setAncForm({ ...ancForm, gestational_age_weeks: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">BP systolic</label>
                  <input className="field-input" type="number" value={ancForm.blood_pressure_systolic} onChange={e => setAncForm({ ...ancForm, blood_pressure_systolic: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">BP diastolic</label>
                  <input className="field-input" type="number" value={ancForm.blood_pressure_diastolic} onChange={e => setAncForm({ ...ancForm, blood_pressure_diastolic: e.target.value })} />
                </div>
              </div>

              <label className="field-label">Complications</label>
              <select className="field-input" value={ancForm.complications} onChange={e => setAncForm({ ...ancForm, complications: e.target.value })}>
                <option value="none">None</option>
                <option value="hypertension">Hypertension</option>
                <option value="diabetes">Gestational diabetes</option>
                <option value="anemia">Anemia</option>
                <option value="swelling">Severe swelling</option>
                <option value="other">Other</option>
              </select>

              <label className="field-label">Notes</label>
              <textarea className="field-input" rows={3} value={ancForm.visit_notes} onChange={e => setAncForm({ ...ancForm, visit_notes: e.target.value })} />

              <button className="btn-primary mt-2" disabled={ancSaving} onClick={submitAnc}>
                {ancSaving ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Save visit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
