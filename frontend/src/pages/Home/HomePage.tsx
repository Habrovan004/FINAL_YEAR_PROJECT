import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Bell, ChevronRight, Loader2,
  Heart, Calendar, PhoneCall,
  Droplets, Apple, ShieldCheck,
  Leaf, BookOpen, AlertTriangle, MessageCircle,
} from 'lucide-react'
import PageWrapper from '../../components/layout/PageWrapper'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
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

function formatDate(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// Map backend trimester string ("1st"/"2nd"/"3rd"/"N/A") to the i18n trimester dict.
function trimesterLabel(t: (k: string) => string, raw: string): string {
  const key = raw.toLowerCase()
  if (key.startsWith('1')) return t('trimester.first')
  if (key.startsWith('2')) return t('trimester.second')
  if (key.startsWith('3')) return t('trimester.third')
  return raw
}

function greetingKey(): 'home_good_morning' | 'home_good_afternoon' | 'home_good_evening' {
  const h = new Date().getHours()
  if (h < 12) return 'home_good_morning'
  if (h < 18) return 'home_good_afternoon'
  return 'home_good_evening'
}

export default function HomePage() {
  const nav = useNavigate()
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const locale = i18n.language?.startsWith('sw') ? 'sw-TZ' : 'en-US'

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

  const rawName = user_name || user?.full_name || 'Mama'
  const firstName = rawName.split(' ')[0]

  const week      = pregnancy_info?.week ?? 0
  const trimesterRaw = pregnancy_info?.trimester ?? 'N/A'
  const trimester = trimesterLabel(t, trimesterRaw)

  const QUICK_ACTIONS = [
    { icon: Heart,         label: t('action_feel'),   sub: t('action_feel_sub'),   to: '/track' },
    { icon: MessageCircle, label: t('action_chat'),   sub: t('action_chat_sub'),   to: '/chat' },
    { icon: Calendar,      label: t('action_visits'), sub: t('action_visits_sub'), to: '/appointments' },
    { icon: PhoneCall,     label: t('action_sos'),    sub: t('action_sos_sub'),    to: '/emergency', danger: true },
  ]

  const TODAY_TIPS = [
    { icon: Droplets,      title: t('tip_water_title'),    desc: t('tip_water_desc'),    type: 'tip' },
    { icon: Apple,         title: t('tip_rainbow_title'),  desc: t('tip_rainbow_desc'),  type: 'tip' },
    { icon: ShieldCheck,   title: t('tip_rest_title'),     desc: t('tip_rest_desc'),     type: 'tip' },
    { icon: AlertTriangle, title: t('tip_swelling_title'), desc: t('tip_swelling_desc'), type: 'warning' },
    { icon: AlertTriangle, title: t('tip_headache_title'), desc: t('tip_headache_desc'), type: 'warning' },
  ]

  const LEARN_CARDS = [
    {
      icon: Leaf,
      label: t('learn_nutrition_label'),
      title: t('learn_nutrition_title', { trimester }),
      desc: t('learn_nutrition_desc'),
      to: '/learn',
      tone: 'green',
    },
    {
      icon: BookOpen,
      label: t('learn_baby_label'),
      title: t('learn_baby_title', { week: week || 15 }),
      desc: t('learn_baby_desc'),
      to: '/baby-growth',
      tone: 'pink',
    },
  ]

  return (
      <PageWrapper>
        <div className="home-page">

          <div className="home-header">
            <div>
              <p className="home-greeting">{t(greetingKey())}</p>
              <h1 className="home-name">{firstName} 💗</h1>
            </div>
            <div className="header-controls">
              <button
                  className="icon-btn"
                  aria-label={t('notifications_aria')}
                  onClick={() => nav('/notifications')}
              >
                <Bell size={17} />
                {notifications_count > 0 && <span className="notif-badge" />}
              </button>
            </div>
          </div>

          <div className="week-card">
            <div>
              <p className="week-label">{t('home_today')}</p>
              <p className="week-number">
                {t('home_week')} {week}{' '}
                <span className="week-trimester">· {trimester}</span>
              </p>
              <p className="week-size">
                {baby_growth
                    ? t('home_baby_size', { size: baby_growth.size_comparison.toLowerCase() })
                    : t('home_baby_calc')}
              </p>
            </div>
            <div className="week-emoji-bubble" role="img" aria-label="baby stage emoji">
              {getBabyEmoji(week)}
            </div>
          </div>

          <p className="section-title">{t('home_this_week')}</p>
          <div className="tiles-grid">
            <div className="info-tile" onClick={() => nav('/baby-growth')} role="button" tabIndex={0}>
              <div>
                <p className="tile-label">{t('home_dev_label')}</p>
                <p className="tile-value">{baby_growth?.title || t('home_dev_default')}</p>
              </div>
              <span className="tile-cta">{t('home_details_cta')}</span>
            </div>
            <div className="info-tile" onClick={() => nav('/timeline')} role="button" tabIndex={0}>
              <div>
                <p className="tile-label">{t('home_health_status')}</p>
                <p className="tile-value">{health_status?.mood_label || t('home_health_safe')}</p>
              </div>
              <span className="tile-cta">{t('home_history_cta')}</span>
            </div>
          </div>

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
                  <p className="appt-label">{t('home_next_appointment')}</p>
                  <p className="appt-value">
                    {next_appointment.visit_type} · {formatDate(next_appointment.date, locale)}
                  </p>
                </div>
                <ChevronRight size={16} className="appt-chevron" />
              </div>
          )}

          <div className="home-divider" />

          <p className="section-title">{t('home_quick_actions')}</p>
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

          <p className="section-title">{t('home_today_tips')}</p>
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
