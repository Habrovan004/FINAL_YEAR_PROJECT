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

function formatDate(dateStr?: string) {
  if (!dateStr) return 'Not set'

  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return 'Not set'

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function calculateWeek(lmpDate?: string) {
  if (!lmpDate) return null

  const lmp = new Date(lmpDate)
  if (Number.isNaN(lmp.getTime())) return null

  const diffDays = Math.floor((Date.now() - lmp.getTime()) / MS_PER_DAY)
  return Math.min(42, Math.max(1, Math.floor(diffDays / 7) + 1))
}

function trimesterLabel(trimester?: string, week?: number | null) {
  if (trimester) {
    const normalized = trimester.toLowerCase()
    if (normalized.includes('1')) return '1st Trimester'
    if (normalized.includes('2')) return '2nd Trimester'
    if (normalized.includes('3')) return '3rd Trimester'
    return trimester
  }

  if (!week) return 'Pregnancy'
  if (week <= 13) return '1st Trimester'
  if (week <= 27) return '2nd Trimester'
  return '3rd Trimester'
}

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [profile, setProfile] = useState<PatientProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchProfile = useCallback(async () => {
    try {
      setError('')
      const response = await api.get('/patients/profile/')
      setProfile(response.data)
    } catch (e) {
      console.error('Profile fetch error:', e)
      setError('Could not load profile details. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

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
      setError('Could not update notifications. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const rawName = user?.full_name?.trim() || 'Mama'
  const firstName = rawName.split(' ')[0] || 'Mama'
  const initial = firstName[0]?.toUpperCase() || 'M'
  const week = profile?.pregnancy_week || calculateWeek(profile?.lmp_date)
  const dueDate = profile?.due_date || (profile?.lmp_date ? addDays(new Date(profile.lmp_date), 280).toISOString() : '')
  const pregnancyBadge = week ? `Week ${week} · ${trimesterLabel(profile?.trimester, week)}` : trimesterLabel(profile?.trimester, week)
  const pregnancySummary = week ? `Week ${week} · Due ${formatDate(dueDate)}` : `Due ${formatDate(dueDate)}`
  const languageLabel = profile?.language === 'sw' ? 'Swahili' : 'English'
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

  const menuItems = [
    {
      icon: UserPlus,
      label: 'Invite your partner',
      sub: 'Share support through a link or code',
      action: () => nav('/profile/partner'),
    },
    {
      icon: Eye,
      label: 'See partner view',
      sub: 'Preview what your partner can see',
      action: () => nav('/profile/partner'),
    },
    {
      icon: Languages,
      label: `Language · ${languageLabel}`,
      sub: 'Switch between English and Swahili',
      action: () => nav('/profile/settings'),
    },
    {
      icon: Bell,
      label: `Notifications · ${notificationsOn ? 'On' : 'Off'}`,
      sub: 'Weekly tips and appointment reminders',
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
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Pregnancy</p>
            <p className="mt-1 text-sm font-black leading-snug text-gray-800">{pregnancySummary}</p>
          </button>

          <button
            onClick={() => nav('/profile/hospitals')}
            className="rounded-3xl border border-gray-100 bg-white p-4 text-left shadow-sm active:bg-gray-50"
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50">
              <Stethoscope size={22} className="text-emerald-500" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Hospital</p>
            <p className="mt-1 text-sm font-black leading-snug text-gray-800">
              {profile?.hospital_name || 'Select hospital'}
            </p>
          </button>
        </section>

        <section className="mt-5 overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
          {menuItems.map(({ icon: Icon, label, sub, action }, index) => (
            <button
              key={label}
              onClick={action}
              disabled={saving && label.startsWith('Notifications')}
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
              {saving && label.startsWith('Notifications') ? (
                <Loader2 size={16} className="animate-spin text-rose-400" />
              ) : (
                <ChevronRight size={18} className="text-gray-300" />
              )}
            </button>
          ))}
        </section>

        <button
          onClick={() => {
            logout()
            nav('/')
          }}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-50 py-4 text-xs font-black uppercase tracking-widest text-rose-500"
        >
          <LogOut size={16} />
          Log out
        </button>
      </div>
    </PageWrapper>
  )
}
