import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Activity, AlertTriangle, MessageSquare, BookOpen, Plus,
  Stethoscope, LogOut, Loader2, X, RefreshCcw,
} from 'lucide-react'
import {
  PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import './manager.css'

interface Stats {
  hospital: { id: number; name: string }
  totals: {
    mothers: number
    providers: number
    visits_this_month: number
    high_risk_this_week: number
  }
  attendance_rate: number
  chatbot_escalation_rate: number
  risk_distribution: { risk_level: string; count: number }[]
  visit_series: { week_starting: string; visits: number }[]
}

interface Provider {
  id: number
  user_id: number
  full_name: string
  phone_number: string
  email: string | null
  specialization: string
  is_available: boolean
  current_workload: number
  max_workload: number
  is_active: boolean
}

interface ContentRow {
  id: number
  title: string
  title_sw: string
  description: string
  description_sw: string
  category_id: number | null
  category_name: string | null
  trimester: string
  is_reviewed: boolean
}

type Tab = 'overview' | 'providers' | 'content'

const RISK_COLORS: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
}

export default function ManagerDashboard() {
  const nav = useNavigate()
  const { user, logout } = useAuth()
  const [tab, setTab] = useState<Tab>('overview')

  const [stats, setStats] = useState<Stats | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [content, setContent] = useState<ContentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const [addProviderOpen, setAddProviderOpen] = useState(false)
  const [addContentOpen, setAddContentOpen] = useState(false)

  const load = async () => {
    setLoading(true)
    setErr('')
    try {
      const [s, p, c] = await Promise.all([
        api.get('/auth/manager/stats/'),
        api.get('/auth/manager/providers/'),
        api.get('/auth/manager/content/'),
      ])
      setStats(s.data)
      setProviders(p.data)
      setContent(c.data)
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  if (loading) {
    return (
      <div className="manager-page flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <Loader2 className="animate-spin text-rose-400" size={32} />
      </div>
    )
  }

  return (
    <div className="manager-page">
      <header className="manager-header">
        <div>
          <p className="manager-eyebrow">Hospital Manager</p>
          <h1 className="manager-name">{user?.full_name}</h1>
          <p className="manager-facility">{stats?.hospital.name || user?.hospital_name}</p>
        </div>
        <div className="manager-header-btns">
          <button onClick={() => void load()} className="icon-btn" title="Refresh"><RefreshCcw size={15} /></button>
          <button onClick={() => { logout(); nav('/') }} className="icon-btn" title="Sign out"><LogOut size={15} /></button>
        </div>
      </header>

      {err && <div className="manager-err">{err}</div>}

      <nav className="manager-tabs">
        {(['overview', 'providers', 'content'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`manager-tab ${tab === t ? 'active' : ''}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      {tab === 'overview' && stats && <Overview stats={stats} />}
      {tab === 'providers' && (
        <Providers
          providers={providers}
          onAdd={() => setAddProviderOpen(true)}
          onChange={() => void load()}
        />
      )}
      {tab === 'content' && (
        <Content
          content={content}
          onAdd={() => setAddContentOpen(true)}
          onChange={() => void load()}
        />
      )}

      {addProviderOpen && (
        <AddProviderModal onClose={() => setAddProviderOpen(false)} onSaved={() => { setAddProviderOpen(false); void load() }} />
      )}
      {addContentOpen && (
        <AddContentModal onClose={() => setAddContentOpen(false)} onSaved={() => { setAddContentOpen(false); void load() }} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────── Overview tab
function Overview({ stats }: { stats: Stats }) {
  const totals = stats.totals
  const riskData = ['low', 'medium', 'high'].map(level => ({
    name: level.toUpperCase(),
    value: stats.risk_distribution.find(r => r.risk_level === level)?.count || 0,
    fill: RISK_COLORS[level],
  }))
  const visitData = stats.visit_series.map(v => ({
    week: new Date(v.week_starting).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    visits: v.visits,
  }))
  return (
    <>
      <section className="manager-stats">
        <div className="stat-card"><Users size={16} className="text-rose-400" /><p className="stat-value">{totals.mothers}</p><p className="stat-label">Mothers</p></div>
        <div className="stat-card"><Stethoscope size={16} className="text-emerald-500" /><p className="stat-value">{totals.providers}</p><p className="stat-label">Providers</p></div>
        <div className="stat-card"><Activity size={16} className="text-indigo-500" /><p className="stat-value">{totals.visits_this_month}</p><p className="stat-label">Visits / 30d</p></div>
        <div className="stat-card"><AlertTriangle size={16} className="text-red-500" /><p className="stat-value">{totals.high_risk_this_week}</p><p className="stat-label">HIGH risk / 7d</p></div>
      </section>

      <section className="manager-section">
        <h2>Attendance & escalation</h2>
        <div className="manager-rate-row">
          <div className="rate-card"><Activity size={14} /><p className="rate-label">ANC attendance</p><p className="rate-value">{stats.attendance_rate}%</p></div>
          <div className="rate-card"><MessageSquare size={14} /><p className="rate-label">Chatbot escalation</p><p className="rate-value">{stats.chatbot_escalation_rate}%</p></div>
        </div>
      </section>

      <section className="manager-section">
        <h2>Risk distribution (last 30 days)</h2>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={riskData} dataKey="value" nameKey="name" innerRadius={36} outerRadius={68} label>
              {riskData.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </section>

      <section className="manager-section">
        <h2>ANC visits — last 6 weeks</h2>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={visitData}>
            <XAxis dataKey="week" fontSize={10} />
            <YAxis fontSize={10} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="visits" stroke="#f472b6" strokeWidth={2} dot />
          </LineChart>
        </ResponsiveContainer>
      </section>
    </>
  )
}

// ─────────────────────────────────────────── Providers tab
function Providers({ providers, onAdd, onChange }: {
  providers: Provider[]
  onAdd: () => void
  onChange: () => void
}) {
  const toggleActive = async (p: Provider) => {
    await api.patch(`/auth/manager/providers/${p.id}/`, { is_active: !p.is_active })
    onChange()
  }

  return (
    <>
      <section className="manager-section">
        <div className="section-header">
          <h2>Providers ({providers.length})</h2>
          <button className="add-btn" onClick={onAdd}><Plus size={14} /> Add</button>
        </div>

        {providers.length === 0 && <p className="manager-empty">No providers yet. Add one above.</p>}
        {providers.map(p => (
          <div key={p.id} className="provider-row">
            <div className="flex-1">
              <p className="row-title">{p.full_name}</p>
              <p className="row-sub">{p.specialization} • {p.phone_number}</p>
              <p className="row-meta">Workload: {p.current_workload}/{p.max_workload}</p>
            </div>
            <button className={`pill ${p.is_active ? 'pill-on' : 'pill-off'}`} onClick={() => void toggleActive(p)}>
              {p.is_active ? 'Active' : 'Inactive'}
            </button>
          </div>
        ))}
      </section>
    </>
  )
}

// ─────────────────────────────────────────── Content tab
function Content({ content, onAdd, onChange }: {
  content: ContentRow[]
  onAdd: () => void
  onChange: () => void
}) {
  const togglePublished = async (c: ContentRow) => {
    await api.patch(`/auth/manager/content/${c.id}/`, { is_reviewed: !c.is_reviewed })
    onChange()
  }
  const remove = async (c: ContentRow) => {
    if (!confirm(`Delete "${c.title}"?`)) return
    await api.delete(`/auth/manager/content/${c.id}/`)
    onChange()
  }
  return (
    <section className="manager-section">
      <div className="section-header">
        <h2><BookOpen size={14} className="inline-block mr-1" /> Educational content ({content.length})</h2>
        <button className="add-btn" onClick={onAdd}><Plus size={14} /> New</button>
      </div>

      {content.length === 0 && <p className="manager-empty">No articles yet.</p>}
      {content.map(c => (
        <div key={c.id} className="content-row">
          <div className="flex-1">
            <p className="row-title">{c.title}</p>
            {c.title_sw && <p className="row-sub">SW: {c.title_sw}</p>}
            <p className="row-meta">{c.category_name || 'General'} • trimester: {c.trimester}</p>
          </div>
          <div className="flex flex-col gap-1 items-end">
            <button className={`pill ${c.is_reviewed ? 'pill-on' : 'pill-off'}`} onClick={() => void togglePublished(c)}>
              {c.is_reviewed ? 'Published' : 'Draft'}
            </button>
            <button className="pill pill-danger" onClick={() => void remove(c)}>Delete</button>
          </div>
        </div>
      ))}
    </section>
  )
}

// ─────────────────────────────────────────── Modals
function AddProviderModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    full_name: '', phone_number: '', email: '', password: '', specialization: 'nurse',
  })
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    if (!form.full_name || !form.phone_number || !form.password) {
      alert('Name, phone and password are required.')
      return
    }
    setSaving(true)
    try {
      await api.post('/auth/manager/providers/', form)
      onSaved()
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not create provider')
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3>New provider</h3><button onClick={onClose}><X size={18} /></button></div>
        <div className="modal-body">
          <label className="field-label">Full name</label>
          <input className="field-input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
          <label className="field-label">Phone</label>
          <input className="field-input" value={form.phone_number} onChange={e => setForm({ ...form, phone_number: e.target.value })} />
          <label className="field-label">Email (optional)</label>
          <input className="field-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <label className="field-label">Password</label>
          <input className="field-input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          <label className="field-label">Specialization</label>
          <select className="field-input" value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })}>
            <option value="nurse">Nurse Practitioner</option>
            <option value="midwife">Midwife</option>
            <option value="obstetrician">Obstetrician</option>
          </select>
          <button className="btn-primary mt-2" disabled={saving} onClick={() => void submit()}>
            {saving ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Create provider'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddContentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: '', title_sw: '', description: '', description_sw: '',
    trimester: 'all', tip_type: 'tip',
  })
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    if (!form.title || !form.description) { alert('Title and English description required.'); return }
    setSaving(true)
    try {
      await api.post('/auth/manager/content/', form)
      onSaved()
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not save')
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3>New article</h3><button onClick={onClose}><X size={18} /></button></div>
        <div className="modal-body">
          <label className="field-label">Title (English)</label>
          <input className="field-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <label className="field-label">Title (Swahili)</label>
          <input className="field-input" value={form.title_sw} onChange={e => setForm({ ...form, title_sw: e.target.value })} />
          <label className="field-label">Body (English)</label>
          <textarea className="field-input" rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <label className="field-label">Body (Swahili)</label>
          <textarea className="field-input" rows={4} value={form.description_sw} onChange={e => setForm({ ...form, description_sw: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">Trimester</label>
              <select className="field-input" value={form.trimester} onChange={e => setForm({ ...form, trimester: e.target.value })}>
                <option value="all">All</option>
                <option value="1">1st</option>
                <option value="2">2nd</option>
                <option value="3">3rd</option>
              </select>
            </div>
            <div>
              <label className="field-label">Type</label>
              <select className="field-input" value={form.tip_type} onChange={e => setForm({ ...form, tip_type: e.target.value })}>
                <option value="tip">Tip</option>
                <option value="warning">Warning</option>
                <option value="nutrition">Nutrition</option>
                <option value="info">Info</option>
              </select>
            </div>
          </div>
          <button className="btn-primary mt-2" disabled={saving} onClick={() => void submit()}>
            {saving ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Publish article'}
          </button>
        </div>
      </div>
    </div>
  )
}
