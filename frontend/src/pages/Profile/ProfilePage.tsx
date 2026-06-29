import { useCallback, useEffect, useState } from 'react'
import {
  Baby,
  Bell,
  ChevronRight,
  Eye,
  Languages,
  Loader2,
  LogOut,
  Stethoscope,
  UserPlus,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import PageWrapper from '../../components/layout/PageWrapper'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'

interface PatientProfile {
  pregnancy_status?: string
  pregnancy_week?: number
  trimester?: string
  hospital_name?: string
  lmp_date?: string
  due_date?: string
  language?: string
  notifications_enabled?: boolean
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function calculateWeek(lmpDate?: string) {
  if (!lmpDate) return null
  const lmp = new Date(lmpDate)
  if (Number.isNaN(lmp.getTime())) return null
  const diffDays = Math.floor((Date.now() - lmp.getTime()) / MS_PER_DAY)
  return Math.min(42, Math.max(1, Math.floor(diffDays / 7) + 1))
}

// Map backend trimester ("1st"/"2nd"/"3rd"/raw) → i18n trimester dict.
function trimesterKey(t: (k: string) => string, trimester?: string, week?: number | null): string {
  const raw = (trimester || '').toLowerCase()
  if (raw.includes('1')) return t('trimester.first')
  if (raw.includes('2')) return t('trimester.second')
  if (raw.includes('3')) return t('trimester.third')
  if (week) {
    if (week <= 13) return t('trimester.first')
    if (week <= 27) return t('trimester.second')
    return t('trimester.third')
  }
  return trimester || ''
}

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const { t, i18n } = useTranslation()
  const locale = i18n.language?.startsWith('sw') ? 'sw-TZ' : 'en-US'

  const [profile, setProfile] = useState<PatientProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return t('profile_not_set')
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return t('profile_not_set')
    return date.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const fetchProfile = useCallback(async () => {
    try {
      setError('')
      const response = await api.get('/patients/profile/')
      setProfile(response.data)
    } catch (e) {
      console.error('Profile fetch error:', e)
      setError(t('profile_load_fail'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    const profileTimer = window.setTimeout(() => {
      fetchProfile()
    }, 0)

    return () => window.clearTimeout(profileTimer)
  }, [fetchProfile])

  const updateNotification = async () => {
    if (!profile) return

    const previous = profile
    const nextValue = !profile.notifications_enabled
    setProfile({ ...profile, notifications_enabled: nextValue })
    setSaving(true)
    setError('')

    try {
      await api.patch('/patients/profile/', { notifications_enabled: nextValue })
    } catch (e) {
      console.error('Notification update error:', e)
      setProfile(previous)
      setError(t('profile_notif_fail'))
    } finally {
      setSaving(false)
    }
  }

  const fallbackName = t('profile_mama')
  const rawName = user?.full_name?.trim() || fallbackName
  const firstName = rawName.split(' ')[0] || fallbackName
  const initial = firstName[0]?.toUpperCase() || 'M'
  const week = profile?.pregnancy_week || calculateWeek(profile?.lmp_date)
  const dueDate = profile?.due_date || (profile?.lmp_date ? addDays(new Date(profile.lmp_date), 280).toISOString() : '')
  const trimester = trimesterKey(t, profile?.trimester, week)
  const pregnancyBadge = week
    ? t('profile_week_trimester', { week, trimester })
    : (trimester || t('profile_pregnancy'))
  const pregnancySummary = week
    ? t('profile_week_due', { week, date: formatDate(dueDate) })
    : t('profile_due_only', { date: formatDate(dueDate) })
  const languageLabel = profile?.language === 'sw' ? t('profile_lang_sw') : t('profile_lang_en')
  const notificationsOn = profile?.notifications_enabled !== false

  if (loading) {
    return (
      <PageWrapper>
        <div className="min-h-[70vh] flex items-center justify-center">
          <Loader2 className="animate-spin text-rose-400" />
        </div>
      </PageWrapper>
    )
  }

  // The Notifications row is the only menu item that triggers an inline action
  // (toggling state) rather than navigating — we tag it so we can disable just
  // that row during the PATCH.
  const NOTIFICATIONS_KEY = 'notifications'

  const menuItems = [
    {
      key: 'invite-partner',
      icon: UserPlus,
      label: t('profile_invite_partner'),
      sub: t('profile_invite_partner_sub'),
      action: () => nav('/profile/partner'),
    },
    {
      key: 'partner-view',
      icon: Eye,
      label: t('profile_partner_view'),
      sub: t('profile_partner_view_sub'),
      action: () => nav('/profile/partner'),
    },
    {
      key: 'language',
      icon: Languages,
      label: t('profile_language_label', { language: languageLabel }),
      sub: t('profile_language_sub'),
      action: () => nav('/profile/settings'),
    },
    {
      key: NOTIFICATIONS_KEY,
      icon: Bell,
      label: t('profile_notifications', {
        state: notificationsOn ? t('profile_notif_on') : t('profile_notif_off'),
      }),
      sub: t('profile_notifications_sub'),
      action: updateNotification,
    },
  ]

  return (
    <PageWrapper>
      <div className="p-5">
        <section className="rounded-[32px] bg-gradient-to-br from-rose-400 via-pink-400 to-rose-500 px-5 py-7 text-center text-white shadow-sm">
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-white text-3xl font-black text-rose-500 shadow-sm">
            {initial}
          </div>
          <h1 className="text-2xl font-black leading-tight">{firstName}</h1>
          <div className="mx-auto mt-3 inline-flex rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold">
            {pregnancyBadge}
          </div>
        </section>

        {error && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-600">
            {error}
          </div>
        )}

        <section className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => nav('/profile/preferences')}
            className="rounded-3xl border border-gray-100 bg-white p-4 text-left shadow-sm active:bg-gray-50"
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50">
              <Baby size={22} className="text-rose-500" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{t('profile_pregnancy')}</p>
            <p className="mt-1 text-sm font-black leading-snug text-gray-800">{pregnancySummary}</p>
          </button>

          <button
            onClick={() => nav('/profile/hospitals')}
            className="rounded-3xl border border-gray-100 bg-white p-4 text-left shadow-sm active:bg-gray-50"
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50">
              <Stethoscope size={22} className="text-emerald-500" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{t('profile_hospital')}</p>
            <p className="mt-1 text-sm font-black leading-snug text-gray-800">
              {profile?.hospital_name || t('profile_select_hospital')}
            </p>
          </button>
        </section>

        <section className="mt-5 overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
          {menuItems.map(({ key, icon: Icon, label, sub, action }, index) => {
            const isBusyRow = saving && key === NOTIFICATIONS_KEY
            return (
              <button
                key={key}
                onClick={action}
                disabled={isBusyRow}
                className={`flex w-full items-center gap-4 p-4 text-left transition-colors active:bg-gray-50 ${
                  index > 0 ? 'border-t border-gray-50' : ''
                }`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50">
                  <Icon size={20} className="text-rose-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-gray-800">{label}</p>
                  <p className="mt-0.5 text-[11px] font-medium leading-snug text-gray-500">{sub}</p>
                </div>
                {isBusyRow ? (
                  <Loader2 size={16} className="animate-spin text-rose-400" />
                ) : (
                  <ChevronRight size={18} className="text-gray-300" />
                )}
              </button>
            )
          })}
        </section>

        <button
          onClick={() => {
            logout()
            nav('/')
          }}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-50 py-4 text-xs font-black uppercase tracking-widest text-rose-500"
        >
          <LogOut size={16} />
          {t('profile_log_out')}
        </button>
      </div>
    </PageWrapper>
  )
}
