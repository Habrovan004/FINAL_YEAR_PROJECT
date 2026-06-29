import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Users, Activity, AlertTriangle, MessageSquare, BookOpen, Plus,
  Stethoscope, LogOut, Loader2, X, RefreshCcw, Moon, Sun, Languages,
  CheckCircle2, AlertCircle, Sparkles,
} from 'lucide-react'
import {
  PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import './manager.css'

// ─────────────────────────────────────────── Types
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

// Shape returned by /api/learn/articles/ (the canonical Learn endpoint)
interface Article {
  id: number
  title: string
  title_sw: string
  description: string
  description_sw: string
  category: number | null
  category_name: string | null
  trimester: string          // "1" | "2" | "3" | "all"
  tip_type: string           // "tip" | "warning" | "nutrition" | "info"
  is_approved: boolean
  is_reviewed: boolean
}

type Tab = 'overview' | 'providers' | 'content'
type ToastKind = 'success' | 'warning' | 'error'
interface Toast { kind: ToastKind; message: string }

const RISK_COLORS: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
}

// ─────────────────────────────────────────── Seed data (15 health tips)
interface SeedTip {
  title_en: string
  title_sw: string
  body_en: string
  body_sw: string
  trimester: '1' | '2' | '3' | 'all'
  tip_type: 'tip' | 'warning'
}

const SEED_TIPS: SeedTip[] = [
  // ── Trimester 1
  { title_en: 'Take folic acid daily', title_sw: 'Kunywa asidi ya foliki kila siku',
    body_en: 'Folic acid helps prevent birth defects. Take 400mcg daily in your first trimester.',
    body_sw: 'Asidi ya foliki husaidia kuzuia kasoro za kuzaliwa. Kunywa 400mcg kila siku.',
    trimester: '1', tip_type: 'tip' },
  { title_en: 'Avoid raw foods', title_sw: 'Epuka vyakula vibichi',
    body_en: 'Raw meat, fish, and unpasteurized dairy can carry bacteria harmful to your baby.',
    body_sw: 'Nyama mbichi, samaki, na maziwa yasiyochemshwa yanaweza kubeba bakteria zinazoweza kudhuru mtoto wako.',
    trimester: '1', tip_type: 'warning' },
  { title_en: 'Stay hydrated', title_sw: 'Kunywa maji ya kutosha',
    body_en: "Drink at least 8 glasses of water daily to support your baby's development and reduce nausea.",
    body_sw: 'Kunywa glasi 8 za maji kila siku ili kusaidia ukuaji wa mtoto wako na kupunguza kichefuchefu.',
    trimester: '1', tip_type: 'tip' },
  { title_en: 'Rest as much as possible', title_sw: 'Pumzika kadri unavyoweza',
    body_en: 'Fatigue is normal in early pregnancy. Listen to your body and sleep when you need to.',
    body_sw: 'Uchovu ni kawaida katika ujauzito wa mapema. Sikiliza mwili wako na lala unapohitaji.',
    trimester: '1', tip_type: 'tip' },
  { title_en: 'Watch for severe nausea', title_sw: 'Angalia kichefuchefu kikali',
    body_en: 'If you cannot keep any food or water down for more than 24 hours, contact your doctor immediately.',
    body_sw: 'Ikiwa huwezi kushikilia chakula au maji kwa zaidi ya masaa 24, wasiliana na daktari wako mara moja.',
    trimester: '1', tip_type: 'warning' },
  // ── Trimester 2
  { title_en: 'Eat iron-rich foods', title_sw: 'Kula vyakula vyenye chuma',
    body_en: 'Iron supports your growing blood supply. Eat beans, lentils, spinach, and lean meat daily.',
    body_sw: 'Chuma husaidia damu inayokua. Kula maharagwe, dengu, mchicha, na nyama kila siku.',
    trimester: '2', tip_type: 'tip' },
  { title_en: 'Do gentle exercise', title_sw: 'Fanya mazoezi ya upole',
    body_en: 'Walking 20–30 minutes daily improves circulation and reduces back pain during pregnancy.',
    body_sw: 'Kutembea dakika 20-30 kila siku huboresha mzunguko wa damu na kupunguza maumivu ya mgongo.',
    trimester: '2', tip_type: 'tip' },
  { title_en: 'Monitor fetal movement', title_sw: 'Fuatilia mwendo wa mtoto',
    body_en: 'By week 20 you should feel your baby move. Track kicks daily and report any reduction to your provider.',
    body_sw: 'Kufikia wiki ya 20 unapaswa kuhisi mtoto wako akisogea. Fuatilia mapigo kila siku na ripoti kupungua kwa mtoa huduma wako.',
    trimester: '2', tip_type: 'warning' },
  { title_en: 'Attend your ANC visit', title_sw: 'Hudhuria ziara yako ya ANC',
    body_en: 'Regular antenatal checkups help catch complications early. Do not skip your scheduled visits.',
    body_sw: 'Uchunguzi wa kawaida wa kabla ya kujifungua husaidia kugundua matatizo mapema. Usiruke ziara zako zilizopangwa.',
    trimester: '2', tip_type: 'tip' },
  { title_en: 'Watch for swelling', title_sw: 'Angalia uvimbe',
    body_en: 'Mild foot swelling is normal but sudden swelling of hands, face, or severe headache needs immediate medical attention.',
    body_sw: 'Uvimbe mdogo wa miguu ni kawaida lakini uvimbe wa ghafla wa mikono, uso, au maumivu makali ya kichwa unahitaji matibabu ya haraka.',
    trimester: '2', tip_type: 'warning' },
  // ── Trimester 3
  { title_en: 'Practice breathing exercises', title_sw: 'Fanya mazoezi ya kupumua',
    body_en: 'Deep breathing exercises prepare your body for labour and help manage pain during contractions.',
    body_sw: 'Mazoezi ya kupumua kwa kina hutayarisha mwili wako kwa leba na kusaidia kudhibiti maumivu wakati wa mikazo.',
    trimester: '3', tip_type: 'tip' },
  { title_en: 'Know the 5-1-1 rule', title_sw: 'Jua sheria ya 5-1-1',
    body_en: 'Go to hospital when contractions are 5 minutes apart, last 1 minute each, for at least 1 hour.',
    body_sw: 'Nenda hospitalini wakati mikazo iko kila dakika 5, inadumu dakika 1 kila moja, kwa angalau saa 1.',
    trimester: '3', tip_type: 'tip' },
  { title_en: 'Prepare your hospital bag', title_sw: 'Andaa mfuko wako wa hospitali',
    body_en: 'Pack your bag by week 36 with ID, maternity records, baby clothes, and personal items.',
    body_sw: 'Andaa mfuko wako kufikia wiki ya 36 ukiwa na kitambulisho, rekodi za uzazi, nguo za mtoto, na vitu vya kibinafsi.',
    trimester: '3', tip_type: 'tip' },
  { title_en: 'Watch for danger signs', title_sw: 'Angalia dalili za hatari',
    body_en: 'Seek immediate help if you experience heavy bleeding, severe headache, blurred vision, or reduced fetal movement.',
    body_sw: 'Tafuta msaada wa haraka ukipata kutokwa damu nyingi, maumivu makali ya kichwa, uoni hafifu, au kupungua kwa mwendo wa mtoto.',
    trimester: '3', tip_type: 'warning' },
  { title_en: 'Sleep on your left side', title_sw: 'Lala upande wako wa kushoto',
    body_en: 'Sleeping on your left side improves blood flow to your baby and reduces pressure on your organs.',
    body_sw: 'Kulala upande wako wa kushoto huboresha mtiririko wa damu kwa mtoto wako na kupunguza shinikizo kwenye viungo vyako.',
    trimester: '3', tip_type: 'tip' },
]

// ─────────────────────────────────────────── Component
export default function ManagerDashboard() {
  const nav = useNavigate()
  const { user, logout } = useAuth()
  const { dark, toggle: toggleTheme } = useTheme()
  const { i18n } = useTranslation()
  const activeLanguage = i18n.language?.startsWith('sw') ? 'sw' : 'en'

  const [tab, setTab] = useState<Tab>('overview')

  const [stats, setStats] = useState<Stats | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [err, setErr] = useState('')

  const [addProviderOpen, setAddProviderOpen] = useState(false)
  const [addContentOpen, setAddContentOpen] = useState(false)

  const [toast, setToast] = useState<Toast | null>(null)

  // Prevents double-seeding under React 18 strict-mode double-mount, fast
  // refresh, or any future remount.
  const seedingRef = useRef(false)

  const toggleLanguage = () => {
    void i18n.changeLanguage(activeLanguage === 'sw' ? 'en' : 'sw')
  }

  const showToast = (kind: ToastKind, message: string) => setToast({ kind, message })

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(t)
  }, [toast])

  // ── Load all dashboard data (silent option drives the refresh button spinner)
  const load = async (opts?: { silent?: boolean }) => {
    if (opts?.silent) setRefreshing(true)
    else setLoading(true)
    setErr('')
    try {
      const [statsRes, provRes] = await Promise.all([
        api.get<Stats>('/auth/manager/stats/'),
        api.get<Provider[]>('/auth/manager/providers/'),
      ])
      setStats(statsRes.data)
      setProviders(provRes.data)
      await loadArticles()
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'Failed to load dashboard'
      setErr(msg)
      showToast('error', msg)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // ── Articles fetch — isolated so we can refresh just the content list
  //    after seeding, and so init failures surface as a toast.
  const loadArticles = async (): Promise<Article[]> => {
    try {
      const res = await api.get<Article[]>('/learn/articles/')
      setArticles(res.data || [])
      return res.data || []
    } catch (e: any) {
      console.error('Failed to load articles', e)
      showToast('error', 'Could not load articles. Pull to refresh.')
      return []
    }
  }

  useEffect(() => { void load() }, [])

  // ── Seed-on-empty: runs once on first load if articles list is empty
  useEffect(() => {
    if (loading || seedingRef.current) return
    if (articles.length > 0) return
    void seedHealthTips()
  }, [loading, articles.length])

  const seedHealthTips = async () => {
    // ── Issue 2: validate token first
    const token = localStorage.getItem('access_token')
    if (!token) {
      showToast('warning', 'Session expired. Please log in again.')
      return
    }

    // Idempotency latch — set BEFORE any network so concurrent strict-mode
    // mounts can't both pass the empty-articles check.
    if (seedingRef.current) return
    seedingRef.current = true
    setSeeding(true)

    try {
      // ── Issue 1: Promise.allSettled so a single failure can't abort the batch
      const results = await Promise.allSettled(
        SEED_TIPS.map(t => api.post('/learn/articles/', {
          title_en: t.title_en,
          title_sw: t.title_sw,
          body_en: t.body_en,
          body_sw: t.body_sw,
          trimester: t.trimester,
          tip_type: t.tip_type,
          is_approved: true,
        }))
      )

      // ── Issue 1: log each individual failure with title_en for easy debugging
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.error(`[seed] Failed: "${SEED_TIPS[i].title_en}"`, r.reason)
        }
      })

      const ok = results.filter(r => r.status === 'fulfilled').length
      const failed = results.length - ok

      // ── Issue 5: refresh articles immediately + switch to Content tab
      await loadArticles()
      setTab('content')

      if (failed === 0) {
        showToast('success', `${ok} health tips seeded successfully`)
      } else if (ok > 0) {
        showToast('warning', `Seeded ${ok}/${results.length} tips — ${failed} failed (see console)`)
      } else {
        showToast('error', 'Seeding failed for all tips — see console')
      }
    } catch (e) {
      // Defensive — Promise.allSettled never throws, but axios interceptors might
      console.error('Seed batch crashed', e)
      showToast('error', 'Seeding failed unexpectedly — see console')
    } finally {
      setSeeding(false)
    }
  }

  // ── Approval toggle from the content card
  const toggleApproved = async (a: Article) => {
    const next = !a.is_approved
    // Optimistic update
    setArticles(prev => prev.map(x => x.id === a.id ? { ...x, is_approved: next } : x))
    try {
      await api.patch(`/learn/articles/${a.id}/`, { is_approved: next })
    } catch (e) {
      // Roll back on failure
      console.error('Approval toggle failed', e)
      setArticles(prev => prev.map(x => x.id === a.id ? { ...x, is_approved: a.is_approved } : x))
      showToast('error', 'Could not update approval — try again')
    }
  }

  const removeArticle = async (a: Article) => {
    if (!confirm(`Delete "${a.title}"?`)) return
    try {
      await api.delete(`/learn/articles/${a.id}/`)
      setArticles(prev => prev.filter(x => x.id !== a.id))
    } catch (e) {
      console.error(e)
      showToast('error', 'Could not delete article')
    }
  }

  if (loading) {
    return (
      <div className="manager-page flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <Loader2 className="manager-spin" size={32} />
      </div>
    )
  }

  return (
    <div className="manager-page">
      <header className="manager-header">
        <div className="manager-header-info">
          <p className="manager-eyebrow">Hospital Manager</p>
          <h1 className="manager-name">{user?.full_name}</h1>
          <p className="manager-facility">{stats?.hospital.name || user?.hospital_name}</p>
        </div>
        <div className="manager-header-actions" role="toolbar" aria-label="Header actions">
          <button type="button" className="mg-header-btn" onClick={toggleTheme}
                  aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button type="button" className="mg-header-btn mg-header-btn--lang"
                  onClick={toggleLanguage} aria-label="Switch language" title="Switch language">
            <Languages size={13} />
            <span>{activeLanguage === 'sw' ? 'SW' : 'EN'}</span>
          </button>
          <button type="button" className="mg-header-btn"
                  onClick={() => void load({ silent: true })} disabled={refreshing}
                  aria-label="Refresh" title="Refresh">
            {refreshing ? <Loader2 size={14} className="manager-spin" /> : <RefreshCcw size={14} />}
          </button>
          <button type="button" className="mg-header-btn"
                  onClick={() => { logout(); nav('/') }} aria-label="Sign out" title="Sign out">
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {err && <div className="manager-err">{err}</div>}

      <nav className="manager-tabs">
        {(['overview', 'providers', 'content'] as Tab[]).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
                  className={`manager-tab ${tab === t ? 'active' : ''}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      {tab === 'overview' && stats && <Overview stats={stats} />}
      {tab === 'providers' && (
        <Providers providers={providers}
                   onAdd={() => setAddProviderOpen(true)}
                   onChange={() => void load({ silent: true })} />
      )}
      {tab === 'content' && (
        <Content articles={articles}
                 seeding={seeding}
                 onAdd={() => setAddContentOpen(true)}
                 onToggleApproved={toggleApproved}
                 onDelete={removeArticle} />
      )}

      {addProviderOpen && (
        <AddProviderModal onClose={() => setAddProviderOpen(false)}
                          onSaved={() => {
                            setAddProviderOpen(false)
                            void load({ silent: true })
                            showToast('success', 'Provider added successfully')
                          }} />
      )}
      {addContentOpen && (
        <AddContentModal onClose={() => setAddContentOpen(false)}
                         onSaved={() => {
                           setAddContentOpen(false)
                           void loadArticles()
                           showToast('success', 'Article published successfully')
                         }} />
      )}

      {toast && (
        <div className={`manager-toast manager-toast--${toast.kind}`}
             role="status" aria-live="polite">
          {toast.kind === 'success' && <CheckCircle2 size={16} />}
          {toast.kind === 'warning' && <AlertCircle size={16} />}
          {toast.kind === 'error'   && <AlertCircle size={16} />}
          <span>{toast.message}</span>
        </div>
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
  const totalVisits = riskData.reduce((sum, r) => sum + r.value, 0)

  const renderRiskLabel = (entry: { name?: string; value?: number; percent?: number }) => {
    if (totalVisits === 0 || !entry.value) return ''
    const pct = Math.round((entry.percent ?? entry.value / totalVisits) * 100)
    return `${entry.name} ${pct}%`
  }

  const visitData = stats.visit_series.map(v => ({
    week: new Date(v.week_starting).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    visits: v.visits,
  }))

  return (
    <>
      <section className="manager-stats">
        <div className="stat-card"><Users size={16} className="stat-icon-rose" /><p className="stat-value">{totals.mothers}</p><p className="stat-label">Mothers</p></div>
        <div className="stat-card"><Stethoscope size={16} className="stat-icon-green" /><p className="stat-value">{totals.providers}</p><p className="stat-label">Providers</p></div>
        <div className="stat-card"><Activity size={16} className="stat-icon-rose" /><p className="stat-value">{totals.visits_this_month}</p><p className="stat-label">Visits / 30d</p></div>
        <div className="stat-card"><AlertTriangle size={16} className="stat-icon-red" /><p className="stat-value">{totals.high_risk_this_week}</p><p className="stat-label">HIGH risk / 7d</p></div>
      </section>

      <section className="manager-section">
        <h2>Attendance &amp; escalation</h2>
        <div className="manager-rate-row">
          <div className="rate-card"><Activity size={14} /><p className="rate-label">ANC attendance</p><p className="rate-value">{stats.attendance_rate}%</p></div>
          <div className="rate-card"><MessageSquare size={14} /><p className="rate-label">Chatbot escalation</p><p className="rate-value">{stats.chatbot_escalation_rate}%</p></div>
        </div>
      </section>

      <section className="manager-section">
        <h2>Risk distribution (last 30 days)</h2>
        <div className="donut-wrap" style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <PieChart>
              <Pie data={riskData} dataKey="value" nameKey="name"
                   innerRadius={50} outerRadius={78}
                   label={renderRiskLabel} labelLine={false}>
                {riskData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center">
            <p className="donut-center-value">{totalVisits}</p>
            <p className="donut-center-label">Total visits</p>
          </div>
        </div>
      </section>

      <section className="manager-section">
        <h2>ANC visits — last 6 weeks</h2>
        <div style={{ width: '100%', height: 180 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <LineChart data={visitData}>
              <XAxis dataKey="week" fontSize={10} />
              <YAxis fontSize={10} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="visits" stroke="#D4537E" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </>
  )
}

// ─────────────────────────────────────────── Providers tab
function Providers({ providers, onAdd, onChange }: {
  providers: Provider[]; onAdd: () => void; onChange: () => void
}) {
  const toggleActive = async (p: Provider) => {
    await api.patch(`/auth/manager/providers/${p.id}/`, { is_active: !p.is_active })
    onChange()
  }

  const duplicates = useMemo(() => {
    const counts: Record<string, number> = {}
    providers.forEach(p => {
      const key = p.full_name.trim().toLowerCase()
      if (key) counts[key] = (counts[key] || 0) + 1
    })
    return new Set(Object.entries(counts).filter(([, n]) => n > 1).map(([k]) => k))
  }, [providers])

  return (
    <section className="manager-section">
      <div className="section-header">
        <h2>Providers ({providers.length})</h2>
        <button className="add-btn" onClick={onAdd}><Plus size={14} /> Add provider</button>
      </div>

      {providers.length === 0 && <p className="manager-empty">No providers yet. Add one above.</p>}

      {providers.map(p => {
        const isDup = duplicates.has(p.full_name.trim().toLowerCase())
        const max = p.max_workload || 50
        const pct = Math.max(0, Math.min(100, Math.round((p.current_workload / max) * 100)))
        return (
          <div key={p.id} className="provider-row">
            <div className="flex-1">
              <p className="row-title">
                <span className="row-title-line">
                  {p.full_name}
                  {isDup && <span className="dup-badge" title="Another provider shares this name">Duplicate?</span>}
                </span>
              </p>
              <p className="row-sub">{p.specialization} • {p.phone_number}</p>
              <p className="row-meta">Workload: {p.current_workload}/{max}</p>
              <div className="workload-bar" role="progressbar"
                   aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
                   aria-label={`Workload ${pct}%`}>
                <div className="workload-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <button className={`pill ${p.is_active ? 'pill-on' : 'pill-off'}`}
                    onClick={() => void toggleActive(p)}>
              {p.is_active ? 'Active' : 'Inactive'}
            </button>
          </div>
        )
      })}
    </section>
  )
}

// ─────────────────────────────────────────── Content tab (article cards)
function Content({ articles, seeding, onAdd, onToggleApproved, onDelete }: {
  articles: Article[]
  seeding: boolean
  onAdd: () => void
  onToggleApproved: (a: Article) => void
  onDelete: (a: Article) => void
}) {
  const trimesterBadge = (t: string) => {
    const map: Record<string, string> = { '1': 'T1', '2': 'T2', '3': 'T3', 'all': 'All' }
    return map[t] || t
  }

  return (
    <section className="manager-section">
      <div className="section-header">
        <h2>
          <BookOpen size={14} className="inline-block mr-1" />
          Educational content ({articles.length})
        </h2>
        <button className="add-btn" onClick={onAdd}><Plus size={14} /> New Article</button>
      </div>

      {seeding && (
        <div className="seed-hint">
          <Sparkles size={14} />
          Seeding 15 starter health tips for your facility…
        </div>
      )}

      {articles.length === 0 && !seeding && (
        <div className="content-empty">
          <BookOpen size={28} className="stat-icon-rose" />
          <p className="content-empty-text">
            No health tips published yet. Create your first article to help
            mothers in your facility.
          </p>
          <button className="content-empty-btn" onClick={onAdd}>
            <Plus size={14} /> New Article
          </button>
        </div>
      )}

      <div className="article-grid">
        {articles.map(a => (
          <article key={a.id} className="article-card">
            <div className="article-card-head">
              <span className="article-tbadge">{trimesterBadge(a.trimester)}</span>
              <span className={`article-type-badge article-type-${a.tip_type}`}>
                {a.tip_type}
              </span>
            </div>
            <p className="article-title">{a.title}</p>
            {a.title_sw && <p className="article-title-sw">SW · {a.title_sw}</p>}

            <div className="article-card-foot">
              <label className="approval-switch" title={a.is_approved ? 'Approved' : 'Draft'}>
                <input type="checkbox" checked={a.is_approved}
                       onChange={() => onToggleApproved(a)} />
                <span className="approval-track">
                  <span className="approval-thumb" />
                </span>
                <span className="approval-label">
                  {a.is_approved ? 'Approved' : 'Draft'}
                </span>
              </label>
              <button className="pill pill-danger" onClick={() => onDelete(a)}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

// ─────────────────────────────────────────── Modals
function AddProviderModal({ onClose, onSaved }: {
  onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    full_name: '', phone_number: '', email: '', password: '',
    specialization: 'nurse',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    if (!form.full_name || !form.phone_number || !form.password) {
      setErr('Name, phone and password are required.')
      return
    }
    setErr('')
    setSaving(true)
    try {
      await api.post('/auth/manager/providers/', form)
      onSaved()
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Could not create provider')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>New provider</h3>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">
          {err && <div className="manager-err">{err}</div>}
          <label className="field-label">Full name</label>
          <input className="field-input" value={form.full_name}
                 onChange={e => setForm({ ...form, full_name: e.target.value })} />
          <label className="field-label">Phone</label>
          <input className="field-input" value={form.phone_number}
                 onChange={e => setForm({ ...form, phone_number: e.target.value })} />
          <label className="field-label">Email (optional)</label>
          <input className="field-input" type="email" value={form.email}
                 onChange={e => setForm({ ...form, email: e.target.value })} />
          <label className="field-label">Password</label>
          <input className="field-input" type="password" value={form.password}
                 onChange={e => setForm({ ...form, password: e.target.value })} />
          <label className="field-label">Specialization</label>
          <select className="field-input" value={form.specialization}
                  onChange={e => setForm({ ...form, specialization: e.target.value })}>
            <option value="nurse">Nurse Practitioner</option>
            <option value="midwife">Midwife</option>
            <option value="obstetrician">Obstetrician</option>
          </select>
          <button className="btn-primary mt-2" disabled={saving} onClick={() => void submit()}>
            {saving ? <Loader2 className="manager-spin mx-auto" size={16} /> : 'Create provider'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddContentModal({ onClose, onSaved }: {
  onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    title_en: '', title_sw: '',
    body_en: '', body_sw: '',
    trimester: 'all', tip_type: 'tip',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    if (!form.title_en || !form.body_en) {
      setErr('English title and body are required.')
      return
    }
    setErr('')
    setSaving(true)
    try {
      await api.post('/learn/articles/', { ...form, is_approved: true })
      onSaved()
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>New article</h3>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">
          {err && <div className="manager-err">{err}</div>}
          <label className="field-label">Title (English)</label>
          <input className="field-input" value={form.title_en}
                 onChange={e => setForm({ ...form, title_en: e.target.value })} />
          <label className="field-label">Title (Swahili)</label>
          <input className="field-input" value={form.title_sw}
                 onChange={e => setForm({ ...form, title_sw: e.target.value })} />
          <label className="field-label">Body (English)</label>
          <textarea className="field-input" rows={4} value={form.body_en}
                    onChange={e => setForm({ ...form, body_en: e.target.value })} />
          <label className="field-label">Body (Swahili)</label>
          <textarea className="field-input" rows={4} value={form.body_sw}
                    onChange={e => setForm({ ...form, body_sw: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label">Trimester</label>
              <select className="field-input" value={form.trimester}
                      onChange={e => setForm({ ...form, trimester: e.target.value })}>
                <option value="all">All</option>
                <option value="1">1st</option>
                <option value="2">2nd</option>
                <option value="3">3rd</option>
              </select>
            </div>
            <div>
              <label className="field-label">Type</label>
              <select className="field-input" value={form.tip_type}
                      onChange={e => setForm({ ...form, tip_type: e.target.value })}>
                <option value="tip">Tip</option>
                <option value="warning">Warning</option>
                <option value="nutrition">Nutrition</option>
                <option value="info">Info</option>
              </select>
            </div>
          </div>
          <button className="btn-primary mt-2" disabled={saving} onClick={() => void submit()}>
            {saving ? <Loader2 className="manager-spin mx-auto" size={16} /> : 'Publish article'}
          </button>
        </div>
      </div>
    </div>
  )
}
