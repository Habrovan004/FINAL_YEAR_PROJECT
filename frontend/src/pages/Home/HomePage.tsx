import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, ChevronRight, Loader2,
  Heart, Calendar, PhoneCall,
  Moon, Sun, Droplets, Apple, ShieldCheck,
  Leaf, BookOpen, Users, AlertTriangle, MessageCircle,
} from 'lucide-react'
import PageWrapper from '../../components/layout/PageWrapper'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext' // Import Auth
import { useTheme } from '../../context/ThemeContext'
import './HomePage.css'

interface DashboardData {
  user_name: string
  pregnancy_info: {
    week: number
    trimester: string
    due_date: string | null
  }
  baby_growth: {
    week: number
    title: string
    description: string
    size_comparison: string
    image: string | null
  } | null
  daily_tip: {
    id: number
    title: string
    description: string
    tip_type: string
  } | null
  health_status: {
    mood_label: string
    logged_at: string | null
  }
  next_appointment: {
    date: string
    visit_type: string
  } | null
  notifications_count: number
}

function getBabyEmoji(week: number): string {
  if (week < 4)  return '🥚'
  if (week < 8)  return '🌱'
  if (week < 12) return '🐣'
  if (week < 16) return '👶'
  if (week < 20) return '👣'
  if (week < 24) return '🤰'
  if (week < 28) return '🍼'
  if (week < 32) return '🧸'
  if (week < 36) return '💖'
  return '🎉'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function HomePage() {
  const nav = useNavigate()
  const { user } = useAuth() // Get global user
  const { dark, toggle } = useTheme()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/patients/dashboard/')
        .then(r => setData(r.data))
        .catch(e => console.error('Dashboard fetch error:', e))
        .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
        <PageWrapper>
          <div className="home-loading">
            <Loader2 className="spin" size={32} />
          </div>
        </PageWrapper>
    )
  }

  const {
    user_name,
    pregnancy_info,
    baby_growth,
    health_status,
    next_appointment,
    notifications_count = 0,
  } = data ?? {}

  // Name Prioritization Logic: Dashboard Response -> Auth User -> 'Mama'
  const rawName = user_name || user?.full_name || 'Mama'
  const firstName = rawName.split(' ')[0]

  const week      = pregnancy_info?.week ?? 0
  const trimester = pregnancy_info?.trimester ?? 'N/A'

  const QUICK_ACTIONS = [
    { icon: Heart,         label: 'How do you feel?', sub: 'Log mood and comfort', to: '/track' },
    { icon: MessageCircle, label: 'Chat',             sub: 'Health Assistant + provider', to: '/chat' },
    { icon: Calendar,      label: 'Visits',           sub: 'ANC and appointments', to: '/appointments' },
    { icon: PhoneCall,     label: 'SOS',              sub: 'Emergency help now',   to: '/emergency', danger: true },
  ]

  const TODAY_TIPS = [
    { icon: Droplets, title: 'Sip water often', desc: 'Aim for 8 glasses today.', type: 'tip' },
    { icon: Apple, title: 'Eat the rainbow', desc: 'Add a colorful veggie at lunch.', type: 'tip' },
    { icon: ShieldCheck, title: 'Rest matters', desc: 'Take a short break when you feel tired.', type: 'tip' },
    { icon: AlertTriangle, title: 'Watch for swelling', desc: 'Call care if face or hands swell suddenly.', type: 'warning' },
    { icon: AlertTriangle, title: 'Strong headache?', desc: 'Seek help if it is severe or will not stop.', type: 'warning' },
  ]

  const LEARN_CARDS = [
    {
      icon: Leaf,
      label: 'Nutrition',
      title: `Eating well in your ${trimester} Trimester`,
      desc: 'Iron, calcium & local foods to focus on',
      to: '/learn',
      tone: 'green',
    },
    {
      icon: BookOpen,
      label: 'Baby Growth',
      title: `Week ${week || 15} highlights`,
      desc: "See how your baby's growing this week",
      to: '/baby-growth',
      tone: 'pink',
    },
    {
      icon: Users,
      label: 'Together',
      title: 'Invite your partner',
      desc: 'Share your journey & key updates',
      to: '/profile/partner',
      tone: 'purple',
    },
  ]

  return (
      <PageWrapper>
        <div className="home-page">

          {/* ── Header ── */}
          <div className="home-header">
            <div>
              <p className="home-greeting">Good morning,</p>
              <h1 className="home-name">{firstName} 💗</h1>
            </div>
            <div className="header-controls">
              <button
                  className="icon-btn"
                  onClick={toggle}
                  aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {dark ? <Sun size={17} /> : <Moon size={17} />}
              </button>

              <button
                  className="icon-btn"
                  aria-label="Notifications"
                  onClick={() => nav('/notifications')}
              >
                <Bell size={17} />
                {notifications_count > 0 && <span className="notif-badge" />}
              </button>
            </div>
          </div>

          {/* ── Pregnancy week card ── */}
          <div className="week-card">
            <div>
              <p className="week-label">Today</p>
              <p className="week-number">
                Week {week}{' '}
                <span className="week-trimester">· {trimester} Trimester</span>
              </p>
              <p className="week-size">
                {baby_growth
                    ? `Baby is about the size of ${baby_growth.size_comparison.toLowerCase()}.`
                    : 'Calculating your baby\'s growth…'}
              </p>
            </div>
            <div className="week-emoji-bubble" role="img" aria-label="baby stage emoji">
              {getBabyEmoji(week)}
            </div>
          </div>

          {/* ── Info tiles ── */}
          <p className="section-title">This week</p>
          <div className="tiles-grid">
            <div className="info-tile" onClick={() => nav('/baby-growth')} role="button" tabIndex={0}>
              <div>
                <p className="tile-label">Development</p>
                <p className="tile-value">{baby_growth?.title || 'Weekly Update'}</p>
              </div>
              <span className="tile-cta">Details →</span>
            </div>
            <div className="info-tile" onClick={() => nav('/timeline')} role="button" tabIndex={0}>
              <div>
                <p className="tile-label">Health status</p>
                <p className="tile-value">{health_status?.mood_label || 'Safe'}</p>
              </div>
              <span className="tile-cta">History →</span>
            </div>
          </div>

          {/* ── Upcoming appointment ── */}
          {next_appointment && (
              <div
                  className="appt-banner"
                  onClick={() => nav('/appointments')}
                  role="button"
                  tabIndex={0}
              >
                <div className="appt-icon-wrap">
                  <Calendar size={20} />
                </div>
                <div className="appt-meta">
                  <p className="appt-label">Next appointment</p>
                  <p className="appt-value">
                    {next_appointment.visit_type} · {formatDate(next_appointment.date)}
                  </p>
                </div>
                <ChevronRight size={16} className="appt-chevron" />
              </div>
          )}

          <div className="home-divider" />

          {/* ── Quick actions ── */}
          <p className="section-title">Quick actions</p>
          <div className="actions-grid">
            {QUICK_ACTIONS.map(({ icon: Icon, label, sub, to, danger }) => (
                <button
                    key={label}
                    className={`action-btn${danger ? ' danger' : ''}`}
                    onClick={() => nav(to)}
                >
                  <div className="action-icon-wrap">
                    <Icon size={22} />
                  </div>
                  <span className="action-label">{label}</span>
                  <span className="action-sub">{sub}</span>
                </button>
            ))}
          </div>

          <div className="home-divider" />

          {/* ── Today's tips ── */}
          <p className="section-title">Today's tips</p>
          <div className="tips-list">
            {TODAY_TIPS.map(({ icon: Icon, title, desc, type }) => (
              <div className={`tip-card ${type}`} key={title}>
                <div className={`tip-icon-wrap ${type}`}>
                  <Icon size={18} />
                </div>
                <div className="tip-copy">
                  <p className="tip-title">{title}</p>
                  <p className="tip-desc">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="learn-card-list" aria-label="Recommended learning">
            {LEARN_CARDS.map(({ icon: Icon, label, title, desc, to, tone }) => (
              <button className={`learn-card ${tone}`} key={label} onClick={() => nav(to)}>
                <div className="learn-icon-wrap">
                  <Icon size={20} />
                </div>
                <div className="learn-copy">
                  <p className="learn-label">{label}</p>
                  <p className="learn-title">{title}</p>
                  <p className="learn-desc">{desc}</p>
                </div>
                <ChevronRight size={17} className="learn-chevron" />
              </button>
            ))}
          </div>

        </div>
      </PageWrapper>
  )
}
