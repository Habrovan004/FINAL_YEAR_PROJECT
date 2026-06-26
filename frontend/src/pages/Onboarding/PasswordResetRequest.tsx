import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../api/client'
import { ArrowLeft, Phone, Mail } from 'lucide-react'
import './auth.css'

export default function PasswordResetRequest(){
  const nav = useNavigate()
  const { t } = useTranslation()
  const [phone, setPhone] = useState('')
  const [channel, setChannel] = useState<'sms' | 'email'>('sms')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const phoneIsValid = /^0?7\d{8}$/.test(phone.replace(/\s+/g, '')) || /^\+?2557\d{8}$/.test(phone.replace(/\s+/g, ''))

  const handleRequest = async (e: React.FormEvent) =>{
    e.preventDefault()
    if (!phoneIsValid) {
      setError(t('invalid_tz_phone'))
      return
    }
    setLoading(true); setError('')
    try{
      const { data } = await api.post('/auth/password-reset/request/', { phone_number: phone, channel })
      nav('/password-reset/confirm', { state: { phoneNumber: phone, channel: data.channel || channel } })
    }catch(err: unknown){
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setError(axiosErr?.response?.data?.error || t('reset_send_failed'))
    }finally{ setLoading(false) }
  }

  return (
    <div className="auth-page auth-page-padded">
      <div className="login-header">
        <button onClick={() => nav('/login')} className="back-btn" aria-label={t('back_to_login')}>
          <ArrowLeft size={18} />
        </button>
      </div>
      <div className="login-titles">
        <h1 className="login-title">{t('reset_password')}</h1>
        <p className="login-subtitle">{channel === 'email' ? t('reset_intro_email') : t('reset_intro_sms')}</p>
      </div>
      <form onSubmit={(e)=>{ void handleRequest(e) }} className="auth-form">
        <div className="field-group">
          <div>
            <label className="field-label">{t('phone_number')}</label>
            <input className="field-input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="e.g. 0712345678 or +255712345678" required />
          </div>
        </div>

        <div className="otp-channel-card" style={{ marginTop: 14 }}>
          <p className="otp-channel-label">{t('send_code_via')}</p>
          <div className="otp-channel-row">
            <button
              type="button"
              onClick={() => setChannel('sms')}
              className={`otp-channel-btn ${channel === 'sms' ? 'active' : ''}`}
            >
              <Phone size={14} /> {t('sms')}
            </button>
            <button
              type="button"
              onClick={() => setChannel('email')}
              className={`otp-channel-btn ${channel === 'email' ? 'active' : ''}`}
            >
              <Mail size={14} /> {t('email')}
            </button>
          </div>
        </div>

        {error && <p className="auth-error">{error}</p>}
        <div className="login-ctas">
          <button className="btn-primary" type="submit" disabled={loading || !phoneIsValid}>{loading ? t('sending_ellipsis') : t('send_code')}</button>
          <button className="btn-ghost" type="button" onClick={() => nav('/login')}>{t('back_to_login')}</button>
        </div>
      </form>
    </div>
  )
}
