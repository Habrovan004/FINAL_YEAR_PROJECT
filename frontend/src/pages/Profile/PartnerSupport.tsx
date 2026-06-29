import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, UserPlus, Share2, CheckCircle2, Copy, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../api/client'

interface Invitation {
  invitation_code: string
  is_confirmed: boolean
  partner_phone: string
  partner_name?: string
}

export default function PartnerSupport() {
  const nav = useNavigate()
  const { t } = useTranslation()

  const [partnerPhone, setPartnerPhone] = useState('')
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [toast, setToast] = useState<{ kind: 'error' | 'success'; message: string } | null>(null)

  const fetchInvitation = useCallback(async () => {
    try {
      const response = await api.get('/auth/partner/invite/')
      setInvitation(response.data)
    } catch (e) {
      console.log('No invitation found', e)
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    fetchInvitation()
  }, [fetchInvitation])

  // Auto-dismiss toast after 3s
  useEffect(() => {
    if (!toast) return
    const tid = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(tid)
  }, [toast])

  const handleInvite = async () => {
    if (!partnerPhone) return
    setLoading(true)
    try {
      const response = await api.post('/auth/partner/invite/', { partner_phone: partnerPhone })
      setInvitation(response.data)
    } catch (e) {
      console.error(e)
      setToast({ kind: 'error', message: t('partner_invite_fail') })
    } finally {
      setLoading(false)
    }
  }

  const copyCode = () => {
    if (invitation?.invitation_code) {
      navigator.clipboard.writeText(invitation.invitation_code)
      setToast({ kind: 'success', message: t('partner_code_copied') })
    }
  }

  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-rose-400" />
      </div>
    )
  }

  const perks = [
    t('partner_perk_growth'),
    t('partner_perk_sos'),
    t('partner_perk_tips'),
    t('partner_perk_appts'),
  ]

  return (
    <div className="min-h-screen pb-24 bg-[#faf9f7] flex justify-center">
      <div className="w-full max-w-lg p-5">
        <header className="flex items-center justify-between mb-8">
          <button
            onClick={() => nav('/profile')}
            className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center"
            aria-label={t('back')}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">{t('partner_title')}</h1>
          <div className="w-10" />
        </header>

        {!invitation ? (
          <div className="animate-in fade-in duration-500">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-6">
                <UserPlus size={32} className="text-rose-400" />
              </div>
              <h2 className="text-xl font-bold mb-2">{t('partner_invite_title')}</h2>
              <p className="text-sm text-gray-500 mb-8">{t('partner_invite_blurb')}</p>

              <div className="space-y-4">
                <div className="text-left">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block pl-1">
                    {t('partner_phone_label')}
                  </label>
                  <input
                    className="input-field bg-gray-50"
                    placeholder={t('partner_phone_placeholder')}
                    value={partnerPhone}
                    onChange={e => setPartnerPhone(e.target.value)}
                  />
                </div>
                <button className="btn-primary" onClick={handleInvite} disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : t('partner_generate_cta')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 text-center">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                {invitation.is_confirmed
                  ? <CheckCircle2 size={32} className="text-green-500" />
                  : <Share2 size={32} className="text-rose-400" />}
              </div>
              <h2 className="text-xl font-bold mb-1">
                {invitation.is_confirmed ? t('partner_linked') : t('partner_sent')}
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                {invitation.is_confirmed
                  ? t('partner_linked_sub', { name: invitation.partner_name || '' })
                  : t('partner_waiting_sub')}
              </p>

              {!invitation.is_confirmed && (
                <div className="bg-gray-50 rounded-2xl p-6 border-2 border-dashed border-gray-200">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    {t('partner_share_code')}
                  </p>
                  <div className="flex items-center justify-center gap-4">
                    <span className="text-3xl font-black tracking-widest text-gray-800">
                      {invitation.invitation_code}
                    </span>
                    <button
                      onClick={copyCode}
                      className="p-2 text-rose-400 active:scale-90 transition-transform"
                      aria-label={t('partner_code_copied')}
                    >
                      <Copy size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-rose-50 rounded-3xl p-6 border border-rose-100">
              <h3 className="font-bold text-sm text-rose-500 mb-3 uppercase tracking-widest">
                {t('partner_will_see')}
              </h3>
              <ul className="space-y-3">
                {perks.map(text => (
                  <li key={text} className="flex items-center gap-3 text-xs font-semibold text-rose-700">
                    <CheckCircle2 size={14} className="opacity-50" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            {!invitation.is_confirmed && (
              <p className="text-center text-[10px] text-gray-400">
                {t('partner_sent_to', { phone: invitation.partner_phone })}
              </p>
            )}
          </div>
        )}

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className={`fixed left-1/2 bottom-24 -translate-x-1/2 px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-lg z-50 ${
              toast.kind === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          >
            {toast.message}
          </div>
        )}
      </div>
    </div>
  )
}
