import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle, Stethoscope, MessageSquare, Users,
  Activity, LogOut, ChevronRight, Loader2, Moon, Sun,
  Languages, CalendarPlus, CheckCircle2,
} from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import ANCVisitModal, { type PatientRow, type ANCSaveResponse } from './ANCVisitModal'
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
    id: number
    type: 'symptom' | 'sos' | 'anc_visit'
    patient: string
    risk?: string
    location?: string
    reasons?: string[]
    time: string
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

export default function ProviderDashboard() {
  const nav = useNavigate()
  const { user, logout } = useAuth()
  const { dark, toggle: toggleTheme } = useTheme()
  const { i18n } = useTranslation()
  const activeLanguage = i18n.language?.startsWith('sw') ? 'sw' : 'en'

  const [data, setData] = useState<DashboardPayload | null>(null)
  const [chatQueue, setChatQueue] = useState<ChatQueueRow[]>([])
  const [patients, setPatients] = useState<PatientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const [ancOpen, setAncOpen] = useState(false)
  const [todayCount, setTodayCount] = useState(0)
  const [toast, setToast] = useState<{ message: string } | null>(null)

  const toggleLanguage = () => {
    const next = activeLanguage === 'sw' ? 'en' : 'sw'
    void i18n.changeLanguage(next)
  }

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    setErr('')
    try {
      const [dash, queue, pats] = await Promise.all([
        api.get<DashboardPayload>('/auth/provider/dashboard/'),
        api.get<ChatQueueRow[]>('/chatbot/provider/queue/'),
        api.get<PatientRow[]>('/patients/'),
      ])
      setData(dash.data)
      setChatQueue(queue.data)
      setPatients(pats.data)
      setTodayCount(dash.data?.appointments?.today?.length ?? 0)
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

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(t)
  }, [toast])

  const handleSaved = (res: ANCSaveResponse) => {
    setAncOpen(false)
    // Optimistic badge bump if the visit scheduled an appointment for today;
    // the next reload will reconcile with the server.
    setTodayCount(c => c)
    void load(true)
    setToast({ message: 'ANC visit recorded successfully' })
    if (res.risk_level === 'high') {
      console.warn('HIGH RISK flagged:', res.risk_reasons)
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
        <Loader2 className="provider-spin" size={32} />
      </div>
    )
  }

  return (
    <div className="provider-page">
      <header className="provider-header">
        <div className="provider-header-info">
          <p className="provider-eyebrow">Provider</p>
          <h1 className="provider-name">{data?.provider_name || user?.full_name}</h1>
          <p className="provider-facility">{data?.hospital || 'Facility'}</p>
        </div>
        <div className="provider-header-actions" role="toolbar" aria-label="Header actions">
          <button
            type="button"
            className="provider-header-btn"
            onClick={toggleTheme}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={dark ? 'Light mode' : 'Dark mode'}
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            type="button"
            className="provider-header-btn provider-header-btn--lang"
            onClick={toggleLanguage}
            aria-label="Switch language"
            title="Switch language"
          >
            <Languages size={13} />
            <span>{activeLanguage === 'sw' ? 'SW' : 'EN'}</span>
          </button>
          <button
            type="button"
            className="provider-header-btn"
            onClick={() => { logout(); nav('/') }}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {err && <div className="provider-err">{err}</div>}

      <section className="provider-stats">
        <div className="stat-card">
          <Users size={18} className="stat-icon stat-icon--rose" />
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
          <Activity size={18} className="stat-icon stat-icon--green" />
          <p className="stat-value">
            {data?.stats.attendance_rate == null ? '—' : `${data.stats.attendance_rate}%`}
          </p>
          <p className="stat-label">Attendance</p>
        </div>
        <div className="stat-card">
          <AlertTriangle size={18} className="stat-icon stat-icon--red" />
          <p className="stat-value">{data?.stats.pending_alerts ?? 0}</p>
          <p className="stat-label">Pending alerts</p>
        </div>
      </section>

      {/* HIGH RISK alerts */}
      <section className="provider-section">
        <div className="provider-section-header">
          <h2>
            <AlertTriangle size={16} className="stat-icon stat-icon--red inline-icon" />
            HIGH RISK alerts
          </h2>
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
            <div
              key={`${a.type}-${a.id}`}
              className={`alert-card ${isHigh ? 'alert-high' : ''}`}
              title={reasonsText}
            >
              <div className="chat-row-body">
                <p className="alert-patient">{a.patient}</p>
                <p className="alert-meta">{meta}</p>
                {reasonsText && <p className="alert-meta chat-preview">{reasonsText}</p>}
              </div>
              <p className="alert-time">
                {new Date(a.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )
        })}
      </section>

      {/* Today's appointments */}
      <section className="provider-section">
        <div className="provider-section-header">
          <h2>Today's appointments</h2>
          <span className="badge" aria-live="polite">{todayCount}</span>
        </div>
        {todaysAppts.length === 0 ? (
          <div className="provider-empty-block">
            <p className="provider-empty">No appointments today.</p>
            <button
              type="button"
              className="provider-empty-cta"
              onClick={() => setAncOpen(true)}
            >
              <CalendarPlus size={14} />
              Schedule appointment
            </button>
          </div>
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
          <h2>
            <MessageSquare size={16} className="stat-icon stat-icon--rose inline-icon" />
            Live chat queue
          </h2>
          <span className="badge">{chatQueue.length}</span>
        </div>
        {chatQueue.length === 0 ? (
          <p className="provider-empty">No escalated chats. The bot is handling everything.</p>
        ) : chatQueue.map(c => {
          const preview = (c.last_message || '').trim()
          const senderLabel = c.last_message_sender === 'chatbot' ? 'Bot: ' : ''
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
              <ChevronRight size={16} className="stat-icon stat-icon--rose" />
            </button>
          )
        })}
      </section>

      {/* Record ANC visit FAB */}
      <button className="anc-fab" onClick={() => setAncOpen(true)} type="button">
        <Stethoscope size={18} />
        Record ANC visit
      </button>

      <ANCVisitModal
        open={ancOpen}
        patients={patients}
        onClose={() => setAncOpen(false)}
        onSaved={handleSaved}
      />

      {toast && (
        <div className="provider-toast" role="status" aria-live="polite">
          <CheckCircle2 size={16} />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  )
}
