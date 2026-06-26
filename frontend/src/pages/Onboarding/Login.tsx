import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import './auth.css'

interface AxiosError {
  response?: {
    data?: {
      error?: string;
      detail?: string;
    }
  }
}

export default function Login() {
  const nav = useNavigate()
  const { setUser } = useAuth()
  const { t } = useTranslation()
  const [form, setForm] = useState({ phone_number: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/auth/login/', form)
      localStorage.setItem('access_token', data.access)
      localStorage.setItem('refresh_token', data.refresh)
      setUser(data.user)
      
      // ✅ Role-based + onboarding-based redirection
      const userType = data.user?.user_type ?? 'patient'
      const isOnboarded = data.user?.is_onboarded ?? false

      if (userType === 'provider') {
        nav('/provider/dashboard')
      } else if (userType === 'hospital_manager') {
        nav('/manager/dashboard')
      } else if (!isOnboarded) {
        nav('/onboarding/hospital') // Mother not onboarded — go to hospital selection
      } else {
        nav('/home') // Mother already onboarded
      }

    } catch (err: unknown) {
      const axiosErr = err as AxiosError;
      setError(axiosErr.response?.data?.error || axiosErr.response?.data?.detail || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page login-page">
      <div className="login-header">
        <button onClick={() => nav('/')} className="back-btn">
          <ArrowLeft size={18} />
        </button>
      </div>

      <div className="login-titles">
        <h1 className="login-title">{t('welcome_back')}</h1>
        <p className="login-subtitle">{t('sign_in_to_continue')}</p>
      </div>

      <form onSubmit={(e) => { void handleLogin(e); }} className="login-form">
        <div className="field-group">
          <div>
            <label className="field-label">{t('phone_number')}</label>
            <input
              className="field-input"
              placeholder="e.g. +255 712 345 678"
              value={form.phone_number}
              onChange={e => setForm({ ...form, phone_number: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="field-label">{t('password')}</label>
            <input
              className="field-input"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="field-row">
          <div />
          <button type="button" className="forgot-link" onClick={() => nav('/password-reset/request')}>{t('forgot_password')}</button>
        </div>

        {error && <div className="auth-error mt-6">{error}</div>}

        <div className="login-ctas">
          <button type="submit" className="btn-primary mt-4" disabled={loading}>
            {loading ? <Loader2 className="animate-spin mx-auto" size={18} /> : t('sign_in')}
          </button>
          <button type="button" className="btn-ghost" onClick={() => nav('/onboarding')}>
            {t('no_account_signup')}
          </button>
        </div>
      </form>
    </div>
  )
}
