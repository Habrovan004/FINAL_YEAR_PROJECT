import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Globe, Bell, Headset, Type, Shield, Loader2 } from 'lucide-react'
import api from '../../api/client'

interface ProfileSettings {
  language: string;
  notifications_enabled: boolean;
  audio_guidance: boolean;
  large_text_mode: boolean;
  [key: string]: string | boolean;
}

export default function SettingsPage() {
  const nav = useNavigate()
  const { t, i18n } = useTranslation()
  const [profile, setProfile] = useState<ProfileSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const colorMap = {
    rose: {
      wrap: 'bg-rose-50',
      icon: 'text-rose-500',
    },
    purple: {
      wrap: 'bg-purple-50',
      icon: 'text-purple-500',
    },
    orange: {
      wrap: 'bg-orange-50',
      icon: 'text-orange-500',
    },
  } as const

  const fetchProfile = useCallback(async () => {
    try {
      setError('')
      const response = await api.get('/patients/profile/')
      setProfile(response.data)
    } catch (e) {
      console.error('Error fetching settings', e)
      setError(t('settings_load_error'))
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

  const updateSetting = async (key: string, value: string | boolean) => {
    if (!profile) return
    const updated = { ...profile, [key]: value }
    setProfile(updated)
    setSaving(true)
    try {
      await api.patch('/patients/profile/', { [key]: value })
      setError('')
    } catch (e) {
      console.error(e)
      setProfile(profile)
      setError(t('settings_save_error'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-rose-400" /></div>

  return (
    <div className="min-h-screen pb-24 bg-[#faf9f7] flex justify-center">
      <div className="w-full max-w-lg p-5">
        <header className="flex items-center justify-between mb-8">
          <button onClick={() => nav('/profile')} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">{t('settings_title')}</h1>
          <div className="w-10 flex justify-center">
            {saving && <Loader2 size={16} className="text-rose-400 animate-spin" />}
          </div>
        </header>

        <div className="space-y-6">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-600">
              {error}
            </div>
          )}

          {/* Language Section */}
          <section>
            <h3 className="font-bold text-xs text-gray-400 uppercase tracking-widest mb-3 pl-1">{t('settings_section_localization')}</h3>
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Globe size={20} className="text-blue-500" />
                </div>
                <div>
                  <p className="font-bold text-sm">{t('settings_language_label')}</p>
                  <p className="text-[10px] text-gray-400">{t('settings_language_sub')}</p>
                </div>
              </div>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                {['en', 'sw'].map(lang => (
                  <button
                    key={lang}
                    onClick={() => {
                      void i18n.changeLanguage(lang)
                      updateSetting('language', lang)
                    }}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${profile?.language === lang ? 'bg-white shadow text-gray-800' : 'text-gray-400'}`}
                  >
                    {lang === 'en' ? 'English' : 'Swahili'}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Preferences Section */}
          <section>
            <h3 className="font-bold text-xs text-gray-400 uppercase tracking-widest mb-3 pl-1">{t('settings_section_preferences')}</h3>
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 divide-y divide-gray-50 overflow-hidden">
              {[
                {
                  key: 'notifications_enabled',
                  icon: Bell,
                  color: 'rose' as const,
                  label: t('settings_notifications_label'),
                  sub: t('settings_notifications_sub')
                },
                {
                  key: 'audio_guidance',
                  icon: Headset,
                  color: 'purple' as const,
                  label: t('audio_guidance'),
                  sub: t('prefs_audio_sub')
                },
                {
                  key: 'large_text_mode',
                  icon: Type,
                  color: 'orange' as const,
                  label: t('settings_large_text_label'),
                  sub: t('settings_large_text_sub')
                }
              ].map(({ key, icon: Icon, color, label, sub }) => (
                <div key={key} className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color].wrap}`}>
                      <Icon size={20} className={colorMap[color].icon} />
                    </div>
                    <div>
                      <p className="font-bold text-sm">{label}</p>
                      <p className="text-[10px] text-gray-400">{sub}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => updateSetting(key, !profile?.[key])}
                    className={`w-12 h-6 rounded-full transition-all relative ${profile?.[key] ? 'bg-rose-400' : 'bg-gray-200'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${profile?.[key] ? 'left-6' : 'left-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Account Security Section */}
          <section>
            <h3 className="font-bold text-xs text-gray-400 uppercase tracking-widest mb-3 pl-1">{t('settings_section_security')}</h3>
            <button className="bg-white w-full p-5 rounded-3xl flex items-center justify-between shadow-sm border border-gray-100 active:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
                  <Shield size={20} className="text-gray-400" />
                </div>
                <div>
                  <p className="font-bold text-sm">{t('settings_change_password')}</p>
                  <p className="text-[10px] text-gray-400">{t('settings_change_password_sub')}</p>
                </div>
              </div>
              <ArrowLeft className="rotate-180 text-gray-300" size={16} />
            </button>
          </section>

          <p className="text-center text-[10px] text-gray-300 font-bold uppercase tracking-[0.2em] pt-8">
            Mimba Yangu v1.0.0
          </p>
        </div>
      </div>
    </div>
  )
}
