import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle, Stethoscope, MessageSquare, Users, Activity, LogOut,
  Loader2, Moon, Sun, Languages, CalendarPlus, CheckCircle2,
  Phone, MessageCircle, X, TrendingUp, TrendingDown, ChevronRight,
} from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import ANCVisitModal, { type PatientRow, type ANCSaveResponse } from './ANCVisitModal'
import './provider.css'

// ── types ─────────────────────────────────────────────────────────────────────

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

interface PatientDetailData {
  summary: {
    full_name: string
    risk_level: string
    phone_number: string
    gestational_age_weeks: number
    trimester: string
    due_date: string | null
  }
  visits: {
    id: number
    visit_date: string
    blood_pressure_systolic: number
    blood_pressure_diastolic: number
    risk_level: string
    risk_reasons: string[]
    weight_kg: number | null
  }[]
}

// ── helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function isOlderThan24h(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() > 86_400_000
}

function extractApiError(e: unknown, fallback: string): string {
  const err = e as any
  if (err?.request && !err?.response) return 'Network error — check connection.'
  const d = err?.response?.data
  if (typeof d === 'string' && d.trim()) return d
  if (d && typeof d === 'object') {
    if (typeof d.error === 'string') return d.error
    if (typeof d.detail === 'string') return d.detail
    const parts = Object.entries(d).map(([k, v]) => {
      const t = Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? v : JSON.stringify(v)
      return t ? `${k}: ${t}` : ''
    }).filter(Boolean)
    if (parts.length) return parts.join('\n')
  }
  if (err?.message) return `${fallback} (${err.message})`
  return fallback
}

function riskColor(r: string) {
  return r === 'high' ? '#E24B4A' : r === 'medium' ? '#F59E0B' : '#1D9E75'
}

// ── Patient slide-in panel ────────────────────────────────────────────────────

function PatientPanel({
  patientId, patientName, onClose,
}: { patientId: number; patientName: string; onClose: () => void }) {
  const [detail, setDetail] = useState<PatientDetailData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get<PatientDetailData>(`/patients/${patientId}/`)
      .then(r => setDetail(r.data))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [patientId])

  const recentVisits = (detail?.visits ?? []).slice(0, 3)

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: 320, maxWidth: '92vw',
          background: '#fff', overflowY: 'auto', padding: '20px 16px',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.14)',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          animation: 'pvSlideIn 0.22s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#D4537E', fontWeight: 700, margin: 0 }}>
              Patient Profile
            </p>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600, margin: '3px 0 0', color: '#1c1c1e' }}>
              {patientName}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b6b70' }}
          >
            <X size={14} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
            <Loader2 size={26} className="provider-spin" />
          </div>
        ) : detail ? (
          <>
            <div style={{ background: '#F7F3F0', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
              {[
                ['Risk level', <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: riskColor(detail.summary.risk_level), padding: '2px 8px', borderRadius: 999 }}>{detail.summary.risk_level.toUpperCase()}</span>],
                ['Gestation', `${detail.summary.gestational_age_weeks}wk · ${detail.summary.trimester}`],
                detail.summary.due_date ? ['Due date', new Date(detail.summary.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })] : null,
                ['Phone', detail.summary.phone_number],
              ].filter(Boolean).map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: i < 3 ? 7 : 0 }}>
                  <span style={{ fontSize: 12, color: '#6b6b70' }}>{row![0] as string}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#1c1c1e' }}>{row![1] as React.ReactNode}</span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#D4537E', fontWeight: 700, marginBottom: 10 }}>
              Recent ANC Visits
            </p>

            {recentVisits.length === 0 ? (
              <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '14px 0' }}>No visits recorded yet.</p>
            ) : recentVisits.map(v => (
              <div key={v.id} style={{ borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.08)', padding: '10px 12px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1c1c1e' }}>
                    {new Date(v.visit_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: riskColor(v.risk_level), background: `${riskColor(v.risk_level)}18`, padding: '1px 7px', borderRadius: 999 }}>
                    {v.risk_level.toUpperCase()}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: '#4b5563', margin: 0 }}>
                  BP {v.blood_pressure_systolic}/{v.blood_pressure_diastolic} mmHg
                  {v.weight_kg ? ` · ${v.weight_kg} kg` : ''}
                </p>
                {v.risk_reasons?.length > 0 && (
                  <p style={{ fontSize: 10, color: '#9ca3af', margin: '3px 0 0' }}>
                    {v.risk_reasons.slice(0, 2).join(' · ')}
                  </p>
                )}
              </div>
            ))}
          </>
        ) : (
          <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>
            Could not load patient details.
          </p>
        )}
      </div>
    </div>
  )
}

// ── main dashboard ────────────────────────────────────────────────────────────

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
  const [ancPatients, setAncPatients] = useState<PatientRow[]>([])
  const [todayCount, setTodayCount] = useState(0)
  const [toast, setToast] = useState<{ message: string } | null>(null)

  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set())
  const [fadingAlerts, setFadingAlerts] = useState<Set<string>>(new Set())
  const [selectedPatient, setSelectedPatient] = useState<{ id: number; name: string } | null>(null)

  // Inject keyframes once
  useEffect(() => {
    const id = 'pv-extra-styles'
    if (document.getElementById(id)) return
    const el = document.createElement('style')
    el.id = id
    el.textContent = `
      @keyframes pvFadeUp   { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      @keyframes pvPulseGlow{ 0%,100%{ box-shadow:0 10px 24px rgba(212,83,126,0.35); } 50%{ box-shadow:0 10px 36px rgba(212,83,126,0.62),0 0 0 5px rgba(212,83,126,0.12); } }
      @keyframes pvDotPulse { 0%,100%{ opacity:1;transform:scale(1); } 50%{ opacity:0.3;transform:scale(1.5); } }
      @keyframes pvFadeOut  { to { opacity:0; max-height:0; padding:0; margin:0; overflow:hidden; } }
      @keyframes pvSlideIn  { from { transform:translateX(100%); } to { transform:translateX(0); } }
      .pv-fade-up   { animation: pvFadeUp 0.35s ease both; }
      .pv-pulse-glow{ animation: pvPulseGlow 2.5s ease-in-out infinite; }
      .pv-dot-pulse { animation: pvDotPulse 1.2s ease-in-out infinite; }
      .pv-fade-out  { animation: pvFadeOut 0.3s ease forwards; }
    `
    document.head.appendChild(el)
    return () => { document.getElementById(id)?.remove() }
  }, [])

  const toggleLanguage = () => void i18n.changeLanguage(activeLanguage === 'sw' ? 'en' : 'sw')

  const load = useCallback(async (silent = false) => {
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
      setAncPatients(pats.data)
      setTodayCount(dash.data?.appointments?.today?.length ?? 0)
    } catch (e) {
      setErr(extractApiError(e, 'Failed to load dashboard'))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(true), 30_000)
    return () => window.clearInterval(id)
  }, [load])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(t)
  }, [toast])

  // Keyboard shortcut R → open modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if ((e.key === 'r' || e.key === 'R') && !ancOpen && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
        setAncOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [ancOpen])

  const handleSaved = (res: ANCSaveResponse) => {
    setAncOpen(false)
    setAncPatients(patients)
    void load(true)
    setToast({ message: 'ANC visit recorded successfully' })
    if (res.risk_level === 'high') console.warn('HIGH RISK flagged:', res.risk_reasons)
  }

  const handleAcknowledge = (key: string) => {
    setFadingAlerts(prev => new Set(prev).add(key))
    setTimeout(() => {
      setAcknowledgedAlerts(prev => new Set(prev).add(key))
      setFadingAlerts(prev => { const n = new Set(prev); n.delete(key); return n })
    }, 300)
  }

  const startVisitFor = (patientName: string) => {
    const matched = patients.filter(p => p.full_name === patientName)
    setAncPatients(matched.length > 0 ? matched : patients)
    setAncOpen(true)
  }

  const todaysAppts = data?.appointments.today ?? []
  const allAlerts = data?.critical_alerts ?? []
  const alerts = allAlerts.filter(a => !acknowledgedAlerts.has(`${a.type}-${a.id}`))

  const highRiskCount = useMemo(
    () => alerts.filter(a => (a.type === 'symptom' || a.type === 'anc_visit') && a.risk === 'high').length,
    [alerts],
  )

  const attendanceRate = data?.stats.attendance_rate ?? null
  const trendUp = attendanceRate != null && attendanceRate >= 75

  const oldestChat = chatQueue.length > 0
    ? chatQueue.reduce((a, b) => ((a.escalated_at || a.updated_at) < (b.escalated_at || b.updated_at) ? a : b))
    : null

  const pendingCount = data?.stats.pending_alerts ?? 0

  // ── shared inline styles ──────────────────────────────────────────────────
  const hBtn: React.CSSProperties = {
    width: 32, height: 32, borderRadius: '50%',
    background: 'rgba(0,0,0,0.06)', border: '0.5px solid rgba(0,0,0,0.08)',
    color: 'var(--pv-text)', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0,
    fontFamily: "'DM Sans', system-ui, sans-serif",
  }

  const iconBtn = (bg: string, color: string): React.CSSProperties => ({
    width: 28, height: 28, borderRadius: '50%', border: 'none',
    background: bg, color, cursor: 'pointer', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  })

  if (loading) {
    return (
      <div className="provider-page flex items-center justify-center">
        <Loader2 className="provider-spin" size={32} />
      </div>
    )
  }

  return (
    <div className="provider-page">

      {/* ── FIX 1: Header ── */}
      <header className="provider-header">
        <div className="provider-header-info">
          <p className="provider-eyebrow">Provider</p>
          <h1 className="provider-name">{data?.provider_name || user?.full_name}</h1>
          <p className="provider-facility">{data?.hospital || 'Facility'}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button type="button" style={hBtn} onClick={toggleTheme} aria-label={dark ? 'Light mode' : 'Dark mode'}>
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button
            type="button"
            style={{ ...hBtn, width: 'auto', padding: '0 10px', gap: 4, fontSize: 11, fontWeight: 700, letterSpacing: '0.4px' }}
            onClick={toggleLanguage}
            aria-label="Switch language"
          >
            <Languages size={13} />
            <span>{activeLanguage === 'sw' ? 'SW' : 'EN'}</span>
          </button>
          <button type="button" style={hBtn} onClick={() => { logout(); nav('/') }} aria-label="Sign out">
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {err && <div className="provider-err">{err}</div>}

      {/* ── FIX 2: Stat cards ── */}
      <section className="provider-stats" style={{ marginBottom: 18 }}>

        {/* Patients */}
        <div
          className="stat-card pv-fade-up"
          style={{ height: 100, borderRadius: 14, animationDelay: '0ms', justifyContent: 'center', gap: 3 }}
        >
          <Users size={16} style={{ color: '#D4537E' }} />
          <p className="stat-value">{data?.stats.total_patients ?? 0}</p>
          <p className="stat-label">Patients</p>
          <p style={{ fontSize: 9, color: '#9ca3af', marginTop: 1 }}>Active this month</p>
        </div>

        {/* Attendance */}
        <div
          className="stat-card pv-fade-up"
          style={{ height: 100, borderRadius: 14, animationDelay: '60ms', justifyContent: 'center', gap: 3 }}
          title={attendanceRate == null ? 'No past appointments yet' : `${data?.stats.attendance_attended ?? 0} of ${data?.stats.attendance_total ?? 0} attended`}
        >
          <Activity size={16} style={{ color: '#1D9E75' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <p className="stat-value">{attendanceRate == null ? '—' : `${attendanceRate}%`}</p>
            {attendanceRate != null && (
              trendUp
                ? <TrendingUp size={13} style={{ color: '#1D9E75' }} />
                : <TrendingDown size={13} style={{ color: '#E24B4A' }} />
            )}
          </div>
          <p className="stat-label">Attendance</p>
        </div>

        {/* Pending alerts */}
        <div
          className="stat-card pv-fade-up"
          style={{
            height: 100, borderRadius: 14, animationDelay: '120ms', justifyContent: 'center', gap: 3,
            ...(pendingCount > 0 ? { background: 'rgba(226,75,74,0.08)', borderColor: '#E24B4A' } : {}),
          }}
        >
          <AlertTriangle size={16} style={{ color: '#E24B4A' }} />
          <p className="stat-value" style={{ color: pendingCount > 0 ? '#E24B4A' : undefined }}>{pendingCount}</p>
          <p className="stat-label">Pending alerts</p>
        </div>
      </section>

      {/* ── FIX 3 + FIX 7: HIGH RISK alerts ── */}
      <section
        className="provider-section pv-fade-up"
        style={{ borderLeft: '3px solid #E24B4A', animationDelay: '80ms' }}
      >
        <div className="provider-section-header">
          <h2>
            <AlertTriangle size={13} style={{ color: '#E24B4A', marginRight: 5, verticalAlign: -2 }} />
            HIGH RISK alerts
          </h2>
          {highRiskCount > 0 && <span className="badge-red">{highRiskCount}</span>}
        </div>

        {alerts.length === 0 ? (
          <p className="provider-empty">No urgent alerts — all clear.</p>
        ) : alerts.map(a => {
          const key = `${a.type}-${a.id}`
          const isFading = fadingAlerts.has(key)
          const isHigh = (a.type === 'symptom' || a.type === 'anc_visit') && a.risk === 'high'
          const isStale = isOlderThan24h(a.time)
          const meta = a.type === 'symptom'
            ? `Symptom report · ${a.risk?.toUpperCase() ?? ''}`
            : a.type === 'sos'
              ? `SOS · ${a.location ?? ''}`
              : `ANC visit · ${a.risk?.toUpperCase() ?? ''}`
          const reasonsText = a.reasons?.length ? a.reasons.join(' · ') : ''
          const matchedPat = patients.find(p => p.full_name === a.patient)

          return (
            <div
              key={key}
              className={isFading ? 'pv-fade-out' : ''}
              style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                gap: 8, padding: '10px 0',
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                position: 'relative',
                ...(isHigh ? {
                  background: 'rgba(226,75,74,0.06)',
                  borderRadius: 12, padding: '10px',
                  marginBottom: 6,
                  border: isStale ? '1.5px solid #E24B4A' : '1px solid rgba(226,75,74,0.2)',
                } : {}),
              }}
            >
              {/* Pulsing dot for stale high-risk */}
              {isHigh && isStale && (
                <span className="pv-dot-pulse" style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 7, height: 7, borderRadius: '50%',
                  background: '#E24B4A', display: 'block',
                }} />
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <button
                  type="button"
                  style={{
                    background: 'none', border: 'none', padding: 0, margin: 0,
                    fontSize: 13, fontWeight: 700,
                    color: matchedPat ? '#D4537E' : '#1c1c1e',
                    cursor: matchedPat ? 'pointer' : 'default',
                    textDecoration: matchedPat ? 'underline dotted' : 'none',
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                  }}
                  onClick={() => matchedPat && setSelectedPatient({ id: matchedPat.id, name: a.patient })}
                  disabled={!matchedPat}
                >
                  {a.patient}
                </button>
                <p className="alert-meta" style={{ marginTop: 2 }}>{meta}</p>
                {reasonsText && <p className="alert-meta" style={{ color: '#9ca3af', marginTop: 2 }}>{reasonsText}</p>}
                <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>{timeAgo(a.time)}</p>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', flexShrink: 0 }}>
                {a.type !== 'sos' && matchedPat && (
                  <button
                    type="button"
                    title="Call patient"
                    style={iconBtn('rgba(29,158,117,0.1)', '#1D9E75')}
                    onClick={() => window.open(`tel:${matchedPat.phone_number}`)}
                  >
                    <Phone size={11} />
                  </button>
                )}
                {a.type !== 'sos' && (
                  <button
                    type="button"
                    title="Message patient"
                    style={iconBtn('rgba(212,83,126,0.1)', '#D4537E')}
                    onClick={() => nav('/provider/chats')}
                  >
                    <MessageCircle size={11} />
                  </button>
                )}
                <button
                  type="button"
                  title="Acknowledge"
                  style={iconBtn('rgba(0,0,0,0.06)', '#6b6b70')}
                  onClick={() => handleAcknowledge(key)}
                >
                  <X size={11} />
                </button>
              </div>
            </div>
          )
        })}
      </section>

      {/* ── FIX 4 + FIX 7: Today's appointments ── */}
      <section
        className="provider-section pv-fade-up"
        style={{ borderLeft: '3px solid #D4537E', animationDelay: '140ms' }}
      >
        <div className="provider-section-header">
          <h2>Today's appointments</h2>
          <span className="badge" aria-live="polite">{todayCount}</span>
        </div>

        {todaysAppts.length === 0 ? (
          <div className="provider-empty-block">
            <p className="provider-empty">No appointments today.</p>
            <button
              type="button"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(212,83,126,0.1)', color: '#D4537E',
                border: '1px solid #D4537E', padding: '7px 14px',
                borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
              onClick={() => setAncOpen(true)}
            >
              <CalendarPlus size={13} />
              Schedule appointment
            </button>
          </div>
        ) : (
          <>
            {todaysAppts.map(a => (
              <div
                key={a.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', gap: 10,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="alert-patient">{a.patient}</p>
                  <p className="alert-meta">{a.type} · {a.time}</p>
                </div>
                <button
                  type="button"
                  style={{
                    background: '#D4537E', color: '#fff', border: 'none',
                    padding: '6px 12px', borderRadius: 8,
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    fontFamily: "'DM Sans', system-ui, sans-serif", flexShrink: 0,
                  }}
                  onClick={() => startVisitFor(a.patient)}
                >
                  Start visit
                </button>
              </div>
            ))}
            <button
              type="button"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(212,83,126,0.1)', color: '#D4537E',
                border: '1px solid #D4537E', padding: '7px 14px',
                borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'DM Sans', system-ui, sans-serif",
                marginTop: 10, marginBottom: 4,
              }}
              onClick={() => setAncOpen(true)}
            >
              <CalendarPlus size={13} />
              Schedule appointment
            </button>
          </>
        )}
      </section>

      {/* ── FIX 6 + FIX 7: Compact chat queue bar ── */}
      <div
        className="pv-fade-up"
        style={{
          borderRadius: 14, padding: '10px 14px', marginBottom: 14,
          background: chatQueue.length > 0 ? 'rgba(212,83,126,0.06)' : '#fff',
          border: chatQueue.length > 0 ? '1px solid #D4537E' : '0.5px solid rgba(0,0,0,0.08)',
          borderLeft: '3px solid #1D9E75',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, animationDelay: '200ms',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <MessageSquare size={14} style={{ color: chatQueue.length > 0 ? '#D4537E' : '#9ca3af', flexShrink: 0 }} />
          {chatQueue.length > 0 ? (
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#1c1c1e', margin: 0 }}>
                {chatQueue.length} waiting
              </p>
              {oldestChat && (
                <p style={{ fontSize: 10, color: '#6b6b70', margin: 0 }}>
                  Oldest: {timeAgo(oldestChat.escalated_at || oldestChat.updated_at)}
                </p>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
              No escalated chats. Bot is handling everything.
            </p>
          )}
        </div>
        {chatQueue.length > 0 && (
          <button
            type="button"
            style={{
              background: '#D4537E', color: '#fff', border: 'none',
              padding: '6px 12px', borderRadius: 8,
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'DM Sans', system-ui, sans-serif",
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4,
            }}
            onClick={() => nav('/provider/chats')}
          >
            View queue <ChevronRight size={12} />
          </button>
        )}
      </div>

      {/* ── FIX 5: Record ANC visit FAB ── */}
      <div style={{
        position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
      }}>
        <button
          type="button"
          className={ancOpen ? undefined : 'pv-pulse-glow'}
          style={{
            background: '#D4537E', color: '#fff', border: 'none',
            padding: '12px 22px', borderRadius: 999,
            fontWeight: 700, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 8,
            cursor: ancOpen ? 'not-allowed' : 'pointer',
            opacity: ancOpen ? 0.8 : 1,
            fontFamily: "'DM Sans', system-ui, sans-serif",
            transition: 'opacity 0.15s',
          }}
          onClick={() => { if (!ancOpen) setAncOpen(true) }}
          disabled={ancOpen}
        >
          {ancOpen ? (
            <><Loader2 size={15} className="provider-spin" /> Recording…</>
          ) : (
            <><Stethoscope size={15} /> Record ANC visit</>
          )}
        </button>
        {!ancOpen && (
          <span style={{ fontSize: 9, color: '#9ca3af', letterSpacing: '0.06em', fontWeight: 600 }}>
            Press R
          </span>
        )}
      </div>

      {/* ── Modals ── */}
      <ANCVisitModal
        open={ancOpen}
        patients={ancPatients}
        onClose={() => { setAncOpen(false); setAncPatients(patients) }}
        onSaved={handleSaved}
      />

      {selectedPatient && (
        <PatientPanel
          patientId={selectedPatient.id}
          patientName={selectedPatient.name}
          onClose={() => setSelectedPatient(null)}
        />
      )}

      {toast && (
        <div className="provider-toast" role="status" aria-live="polite">
          <CheckCircle2 size={16} />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  )
}
