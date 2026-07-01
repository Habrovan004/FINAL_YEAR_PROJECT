import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../api/client'
import { ArrowLeft } from 'lucide-react'
import './auth.css'

export default function PasswordResetRequest() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const [phone, setPhone] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const phoneIsValid = /^0?7\d{8}$/.test(phone.replace(/\s+/g, '')) || /^\+?2557\d{8}$/.test(phone.replace(/\s+/g, ''))
  const passwordIsValid = newPass.length >= 6
  const passwordsMatch = newPass === confirmPass
  const canSubmit = phoneIsValid && passwordIsValid && passwordsMatch

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phoneIsValid) { setError(t('invalid_tz_phone')); return }
    if (!passwordIsValid) { setError(t('password_min_8')); return }
    if (!passwordsMatch) { setError(t('passwords_no_match')); return }

    setLoading(true); setError(''); setSuccess('')
    try {
      await api.post('/auth/password-reset/', { phone_number: phone, new_password: newPass })
      setSuccess(t('reset_success'))
      setTimeout(() => nav('/login'), 1500)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setError(axiosErr?.response?.data?.error || t('reset_failed'))
    } finally {
      setLoading(false)
    }
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
        <p className="login-subtitle">{t('reset_intro_sms')}</p>
      </div>
      <form onSubmit={(e) => { void handleReset(e) }} className="auth-form">
        <div className="field-group">
          <div>
            <label className="field-label">{t('phone_number')}</label>
            <input
              className="field-input"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. 0712345678 or +255712345678"
              required
            />
          </div>
          <div>
            <label className="field-label">{t('new_password')}</label>
            <input
              className="field-input"
              type="password"
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              placeholder={t('new_password')}
              required
            />
          </div>
          <div>
            <label className="field-label">{t('confirm_password')}</label>
            <input
              className="field-input"
              type="password"
              value={confirmPass}
              onChange={e => setConfirmPass(e.target.value)}
              placeholder={t('confirm_password')}
              required
            />
          </div>
        </div>

        {error && <p className="auth-error">{error}</p>}
        {success && <p className="auth-success">{success}</p>}

        <div className="login-ctas">
          <button className="btn-primary" type="submit" disabled={loading || !canSubmit}>
            {loading ? t('saving_ellipsis') : t('set_password')}
          </button>
          <button className="btn-ghost" type="button" onClick={() => nav('/login')}>
            {t('back_to_login')}
          </button>
        </div>
      </form>
    </div>
  )
}
