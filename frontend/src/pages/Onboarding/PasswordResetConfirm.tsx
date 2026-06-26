import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../api/client'
import { ArrowLeft } from 'lucide-react'
import './auth.css'

interface LocationState { phoneNumber?: string }

export default function PasswordResetConfirm(){
  const nav = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const { phoneNumber } = (location.state as LocationState) || { phoneNumber: '' }

  const [phone, setPhone] = useState(phoneNumber || '')
  const [code, setCode] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const codeIsValid = /^\d{6}$/.test(code)
  const passwordIsValid = newPass.length >= 8
  const passwordsMatch = newPass === confirmPass

  const handleConfirm = async (e: React.FormEvent) =>{
    e.preventDefault(); setLoading(true); setError(''); setSuccess('')
    if (!codeIsValid) { setLoading(false); setError(t('enter_6_digit_code')); return }
    if (!passwordIsValid) { setLoading(false); setError(t('password_min_8')); return }
    if (!passwordsMatch) { setLoading(false); setError(t('passwords_no_match')); return }
    try{
      await api.post('/auth/password-reset/confirm/', { phone_number: phone, code, new_password: newPass })
      setSuccess(t('reset_success'))
      setTimeout(()=> nav('/login'), 1500)
    }catch(err: unknown){
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setError(axiosErr?.response?.data?.error || t('reset_failed'))
    }finally{ setLoading(false) }
  }

  return (
    <div className="auth-page auth-page-padded">
      <div className="login-header">
        <button onClick={() => nav('/password-reset/request')} className="back-btn" aria-label={t('back')}>
          <ArrowLeft size={18} />
        </button>
      </div>
      <div className="login-titles">
        <h1 className="login-title">{t('set_new_password')}</h1>
        <p className="login-subtitle">{t('reset_confirm_intro')}</p>
      </div>
      <form onSubmit={(e)=>{ void handleConfirm(e) }} className="auth-form">
        <div className="field-group">
          <div>
            <label className="field-label">{t('phone_number')}</label>
            <input className="field-input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="0712345678" required />
          </div>
          <div>
            <label className="field-label">{t('code_label')}</label>
            <input className="field-input" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={t('six_digit_code')} inputMode="numeric" required />
          </div>
          <div>
            <label className="field-label">{t('new_password')}</label>
            <input className="field-input" type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder={t('new_password')} required />
          </div>
          <div>
            <label className="field-label">{t('confirm_password')}</label>
            <input className="field-input" type="password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} placeholder={t('confirm_password')} required />
          </div>
        </div>

        {error && <p className="auth-error">{error}</p>}
        {success && <p className="auth-success">{success}</p>}

        <div className="login-ctas">
          <button className="btn-primary" type="submit" disabled={loading || !codeIsValid || !passwordIsValid || !passwordsMatch}>{loading ? t('saving_ellipsis') : t('set_password')}</button>
          <button className="btn-ghost" type="button" onClick={() => nav('/login')}>{t('back_to_login')}</button>
        </div>
      </form>
    </div>
  )
}

