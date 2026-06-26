import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Loader2, Mail, Phone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import './auth.css'

interface LocationState {
  phoneNumber: string
  channel?: 'sms' | 'email'
  email?: string | null
}

const OTP_LENGTH = 6

// Define the FormData interface to match OnboardingFlow.tsx
interface FormData {
  full_name: string; date_of_birth: string; phone_number: string; password: string
  pregnancy_status: string; lmp_date: string; due_date: string
  is_first_pregnancy: boolean; previous_pregnancies: number; previous_complications: string[]
  weight_kg: string; height_cm: string; initial_symptoms: { name: string; severity: 'mild' | 'moderate' | 'severe'; }[]
  hospital: string; language: string
  notifications_enabled: boolean; audio_guidance: boolean; font_size: 'small' | 'medium' | 'large'
}

interface ApiError {
  response?: { data?: any }
}

const getApiErrorMessage = (err: unknown, fallback: string) => {
  const data = (err as ApiError).response?.data
  if (!data) return fallback
  if (data.error) return data.error
  if (data.detail) return data.detail
  if (typeof data === 'string') return data.slice(0, 120)

  const firstKey = Object.keys(data)[0]
  const firstValue = data[firstKey]
  if (Array.isArray(firstValue)) return `${firstKey}: ${firstValue[0]}`
  if (typeof firstValue === 'string') return `${firstKey}: ${firstValue}`
  return fallback
}

export default function VerifyOTP() {
  const nav      = useNavigate()
  const location = useLocation()
  const { setUser } = useAuth()
  const { t } = useTranslation()

  const state: LocationState = (location.state as LocationState) || {
    phoneNumber: localStorage.getItem('pending_phone') || '',
  }
  const { phoneNumber, channel: initialChannel, email } = state

  const [digits, setDigits]     = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [verified, setVerified] = useState(false)
  const [resent, setResent]     = useState(false)
  const [channel, setChannel]   = useState<'sms' | 'email'>(initialChannel === 'email' ? 'email' : 'sms')
  const [resentChannel, setResentChannel] = useState<'sms' | 'email' | null>(null)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Redirect to onboarding if no phone number
  useEffect(() => {
    if (!phoneNumber) {
      void nav('/onboarding')
    }
  }, [phoneNumber, nav])

  // Auto-focus first box on mount
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const code = digits.join('')

   const handleVerify = useCallback(async () => {
     if (code.length !== OTP_LENGTH) {
       setError('Please enter the full 6-digit code.')
       return
     }
     setLoading(true)
     setError('')
     try {
       // 1. Verify OTP
       const response = await api.post('/auth/verify-otp/', {
         phone_number: phoneNumber,
         code,
       })

       // Save tokens
       localStorage.setItem('access_token', response.data.access)
       localStorage.setItem('refresh_token', response.data.refresh)

       let updatedUser = response.data.user;

       // 2. Retrieve and send remaining onboarding data if available
       const onboardingDataString = localStorage.getItem('onboarding_data');
       if (onboardingDataString) {
         const onboardingData: FormData = JSON.parse(onboardingDataString);

         // Prepare data for the backend. Ensure hospital_id is an integer.
         const dataToSend = {
           pregnancy_status: onboardingData.pregnancy_status,
           lmp_date: onboardingData.lmp_date,
           due_date: onboardingData.due_date,
           is_first_pregnancy: onboardingData.is_first_pregnancy,
           previous_pregnancies: onboardingData.previous_pregnancies,
           previous_complications: onboardingData.previous_complications,
           weight_kg: parseFloat(onboardingData.weight_kg), // Convert to number
           height_cm: parseFloat(onboardingData.height_cm), // Convert to number
           initial_symptoms: onboardingData.initial_symptoms,
           hospital_id: onboardingData.hospital ? parseInt(onboardingData.hospital) : null, // Convert to integer or null
           language: onboardingData.language,
           notifications_enabled: onboardingData.notifications_enabled,
           audio_guidance: onboardingData.audio_guidance,
           font_size: onboardingData.font_size,
         };

         // Send onboarding data to a backend endpoint to complete the profile
         // This endpoint should update the user's profile and set is_onboarded to true
         const onboardResponse = await api.post('/patients/complete-onboarding/', dataToSend);
         updatedUser = onboardResponse.data; // Use the updated user data from onboarding endpoint
         localStorage.removeItem('onboarding_data'); // Clear onboarding data after successful submission
         localStorage.removeItem('pending_phone'); // Clear pending phone after successful submission
       }

       // 3. Update global user state
       if (updatedUser) {
         setUser(updatedUser)
       }

       setVerified(true)

       // 4. Navigate based on role AND onboarding status
       const userType    = updatedUser?.user_type ?? 'patient'
       const isOnboarded = updatedUser?.is_onboarded ?? false // Use updatedUser's is_onboarded status

       setTimeout(() => {
         if (userType === 'provider') {
           nav('/provider/dashboard')
         } else if (userType === 'hospital_manager') {
           nav('/manager/dashboard')
         } else if (!isOnboarded) {
           nav('/onboarding/hospital')
         } else {
           nav('/home')
         }
       }, 1600)

     } catch (err: unknown) {
       const errorMsg = getApiErrorMessage(err, 'We verified your phone, but could not finish setup. Please try again.')
       setError(errorMsg)
     } finally {
       setLoading(false)
     }
   }, [code, phoneNumber, nav, setUser])

  const handleDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next  = [...digits]
    next[index] = digit
    setDigits(next)
    setError('')
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits]
        next[index] = ''
        setDigits(next)
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus()
      }
    }
    if (e.key === 'Enter' && code.length === OTP_LENGTH) {
      void handleVerify()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    const next   = [...digits]
    pasted.split('').forEach((d, i) => { next[i] = d })
    setDigits(next)
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1)
    inputRefs.current[focusIdx]?.focus()
  }

  const handleResend = async (via: 'sms' | 'email' = channel) => {
    try {
      const { data } = await api.post('/auth/send-otp/', {
        phone_number: phoneNumber,
        channel: via,
      })
      setChannel((data?.channel as 'sms' | 'email') || via)
      setResentChannel((data?.channel as 'sms' | 'email') || via)
      setResent(true)
      setError('')
      setTimeout(() => setResent(false), 4000)
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'Could not resend code. Please try again.')
      setError(msg)
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (verified) {
    return (
        <div className="auth-page otp-page otp-success">
          <div className="success-bubble" role="img" aria-label="Success">✅</div>
          <h2 className="success-title">{t('verified')}</h2>
          <p className="success-sub">
            {t('welcome_to_mimba')}<br />
            {t('redirecting')}
          </p>
        </div>
    )
  }

  // ── Main screen ───────────────────────────────────────────────────────────
  const destination = channel === 'email' ? (email || phoneNumber) : phoneNumber

  return (
      <div className="auth-page otp-page">
        <div className="otp-header">
          <button className="back-btn" onClick={() => nav(-1)} aria-label="Go back">
            <ArrowLeft size={18} />
          </button>
        </div>

        <div className="otp-titles">
          <h1 className="otp-title">{channel === 'email' ? t('verify_email_title') : t('verify_phone_title')}</h1>
          <p className="otp-subtitle">
            {channel === 'email' ? t('otp_subtitle_email') : t('otp_subtitle_sms')}{' '}
            <strong className="otp-phone">{destination}</strong>
          </p>
        </div>

        {/* Channel switcher */}
        <div className="otp-channel-card">
          <p className="otp-channel-label">{t('send_code_via')}</p>
          <div className="otp-channel-row">
            <button
              type="button"
              onClick={() => { void handleResend('sms') }}
              className={`otp-channel-btn ${channel === 'sms' ? 'active sms' : ''}`}
            >
              <Phone size={16} />
              {t('sms')}
            </button>
            <button
              type="button"
              onClick={() => { void handleResend('email') }}
              className={`otp-channel-btn ${channel === 'email' ? 'active email' : ''}`}
            >
              <Mail size={16} />
              {t('email')}
            </button>
          </div>
        </div>

        {/* OTP card */}
        <div className="otp-card">
          <p className="otp-card-label">{t('enter_otp_code')}</p>

          <div className="otp-boxes" onPaste={handlePaste}>
            {digits.map((d, i) => (
                <input
                    key={i}
                    ref={el => { inputRefs.current[i] = el }}
                    className={`otp-box${d ? ' otp-box--filled' : ''}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    aria-label={`Digit ${i + 1}`}
                    onChange={e => handleDigit(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                />
            ))}
          </div>

          <div className="otp-divider" />

          {error ? (
              <p className="otp-error" role="alert">{error}</p>
          ) : resent ? (
              <p className="otp-resent">
                {resentChannel === 'email' ? t('code_resent_email') : t('code_resent_sms')} ✓
              </p>
          ) : (
              <p className="otp-hint">{t('code_expires_in_10')}</p>
          )}
        </div>

        <div className="otp-ctas">
          <button
              className="btn-primary"
              onClick={() => { void handleVerify() }}
              disabled={loading || code.length < OTP_LENGTH}
          >
            {loading
                ? <><Loader2 size={16} className="otp-spin" /> {t('verifying')}</>
                : t('confirm_and_enter')}
          </button>
          <button className="btn-ghost" onClick={() => { void handleResend() }}>
            {channel === 'email' ? t('resend_via_email') : t('resend_via_sms')}
          </button>
        </div>
      </div>
  )
}
