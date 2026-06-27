import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Loader2, Baby, Stethoscope, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import './auth.css'

interface AxiosError {
  response?: {
    data?: {
      error?: string;
      detail?: string;
      non_field_errors?: string[];
    }
  }
}

type LoginRole = 'patient' | 'provider' | 'hospital_manager'

const ROLES: { id: LoginRole; labelKey: string; Icon: typeof Baby }[] = [
  { id: 'patient', labelKey: 'role_mama', Icon: Baby },
  { id: 'provider', labelKey: 'role_provider', Icon: Stethoscope },
  { id: 'hospital_manager', labelKey: 'role_manager', Icon: ShieldCheck },
]

/**
 * Accepts `0XXXXXXXXX`, `+255XXXXXXXXX`, or `XXXXXXXXX` and returns
 * the canonical `0XXXXXXXXX` form. Returns null if it can't be coerced.
 */
function normalizeTzPhone(raw: string): string | null {
  const digits = raw.replace(/\s+/g, '').replace(/^\+?/, '')
  if (/^0\d{9}$/.test(raw.replace(/\s+/g, ''))) return raw.replace(/\s+/g, '')
  if (/^255\d{9}$/.test(digits)) return '0' + digits.slice(3)
  if (/^\d{9}$/.test(digits)) return '0' + digits
  return null
}

export default function Login() {
  const nav = useNavigate()
  const { setUser } = useAuth()
  const { t } = useTranslation()
  const [role, setRole] = useState<LoginRole>('patient')
  const [form, setForm] = useState({ phone_number: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const phoneError = useMemo(() => {
    if (!form.phone_number) return ''
    return normalizeTzPhone(form.phone_number) === null ? t('invalid_tz_phone') : ''
  }, [form.phone_number, t])

  const passwordError = useMemo(() => {
    if (!form.password) return ''
    return form.password.length < 6 ? t('password_min_6') : ''
  }, [form.password, t])

  const canSubmit = !loading
    && form.phone_number.trim().length > 0
    && form.password.length >= 6
    && !phoneError

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const normalized = normalizeTzPhone(form.phone_number)
    if (!normalized) {
      setError(t('invalid_tz_phone'))
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/auth/login/', {
        phone_number: normalized,
        password: form.password,
      })
      localStorage.setItem('access_token', data.access)
      localStorage.setItem('refresh_token', data.refresh)
      setUser(data.user)

      // Role-based redirect — backend `user_type` wins over the on-page selector.
      const userType = data.user?.user_type ?? role
      const isOnboarded = data.user?.is_onboarded ?? false

      if (userType === 'provider') {
        nav('/provider/dashboard')
      } else if (userType === 'hospital_manager') {
        nav('/manager/dashboard')
      } else if (!isOnboarded) {
        nav('/onboarding/hospital')
      } else {
        nav('/home')
      }
    } catch (err: unknown) {
      const axiosErr = err as AxiosError
      const data = axiosErr.response?.data
      const msg =
        data?.error
        || data?.detail
        || (data?.non_field_errors && data.non_field_errors[0])
        || 'Invalid credentials'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page login-page">
      <div className="login-header">
        <button onClick={() => nav('/')} className="back-btn" aria-label={t('back')}>
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
            <label className="field-label">{t('signing_in_as')}</label>
            <div className="role-selector" role="radiogroup" aria-label={t('signing_in_as')}>
              {ROLES.map(({ id, labelKey, Icon }) => {
                const active = role === id
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`role-card${active ? ' role-card--active' : ''}`}
                    onClick={() => setRole(id)}
                  >
                    <Icon size={18} />
                    <span>{t(labelKey)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="phone_number">{t('phone_number')}</label>
            <input
              id="phone_number"
              className={`field-input${phoneError ? ' field-input--error' : ''}`}
              placeholder="e.g. 0712345678"
              autoComplete="tel"
              inputMode="tel"
              value={form.phone_number}
              onChange={e => setForm({ ...form, phone_number: e.target.value })}
              required
            />
            {phoneError && <p className="field-inline-error">{phoneError}</p>}
          </div>

          <div>
            <label className="field-label" htmlFor="password">{t('password')}</label>
            <div className="field-with-action">
              <input
                id="password"
                className={`field-input${passwordError ? ' field-input--error' : ''}`}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="current-password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
              />
              <button
                type="button"
                className="field-action-btn"
                onClick={() => setShowPassword(s => !s)}
                aria-label={showPassword ? t('hide_password') : t('show_password')}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {passwordError && <p className="field-inline-error">{passwordError}</p>}
          </div>
        </div>

        <div className="field-row">
          <div />
          <button type="button" className="forgot-link" onClick={() => nav('/password-reset/request')}>{t('forgot_password')}</button>
        </div>

        {error && <div className="auth-error mt-6">{error}</div>}

        <div className="login-ctas">
          <button type="submit" className="btn-primary mt-4" disabled={!canSubmit}>
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
