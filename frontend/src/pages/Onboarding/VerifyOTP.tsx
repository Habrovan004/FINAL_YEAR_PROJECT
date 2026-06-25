import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Loader2, Moon, Sun, Mail, Phone } from 'lucide-react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import './auth.css'

interface LocationState {
  phoneNumber: string
  devOtp?: string
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
  const { dark, toggle } = useTheme()
  const { setUser } = useAuth()

  const { phoneNumber, devOtp } = (location.state as LocationState) || {
    phoneNumber: localStorage.getItem('pending_phone') || '',
  }

  const [digits, setDigits]     = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [verified, setVerified] = useState(false)
  const [resent, setResent]     = useState(false)
  const [channel, setChannel]   = useState<'sms' | 'email'>('sms')
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
          <h2 className="success-title">Verified!</h2>
          <p className="success-sub">
            Welcome to Mimba Yangu.<br />
            Redirecting you…
          </p>
        </div>
    )
  }

  // ── Main screen ───────────────────────────────────────────────────────────
  return (
      <div className="auth-page otp-page">
        <button
            className="auth-theme-btn"
            onClick={toggle}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <div className="otp-header">
          <button className="back-btn" onClick={() => nav(-1)} aria-label="Go back">
            <ArrowLeft size={18} />
          </button>
        </div>

        <div className="otp-titles">
          <h1 className="otp-title">Verify {channel === 'email' ? 'email' : 'phone'}</h1>
          <p className="otp-subtitle">
            We sent a 6-digit code via {channel === 'email' ? 'email' : 'SMS'} to{' '}
            <strong className="otp-phone">{phoneNumber}</strong>
          </p>
        </div>

        {/* Channel switcher */}
        <div style={{
          background: '#fff',
          border: '1px solid #f3f4f6',
          borderRadius: 14,
          padding: '12px 14px',
          marginBottom: 16,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}>
          <p style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 8,
            textAlign: 'center',
          }}>
            Send code via
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => { void handleResend('sms') }}
              style={{
                flex: 1,
                padding: '12px 8px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                border: channel === 'sms' ? '2px solid #f472b6' : '1px solid #e5e7eb',
                background: channel === 'sms' ? '#fce7f3' : '#fff',
                color: channel === 'sms' ? '#be185d' : '#374151',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Phone size={16} />
              SMS
            </button>
            <button
              type="button"
              onClick={() => { void handleResend('email') }}
              style={{
                flex: 1,
                padding: '12px 8px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                border: channel === 'email' ? '2px solid #6366f1' : '1px solid #e5e7eb',
                background: channel === 'email' ? '#dbeafe' : '#fff',
                color: channel === 'email' ? '#1e40af' : '#374151',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Mail size={16} />
              Email
            </button>
          </div>
        </div>

        {/* OTP card */}
        <div className="otp-card">
          <p className="otp-card-label">Enter OTP code</p>

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
              <p className="otp-resent">A new code has been sent via {resentChannel === 'email' ? 'email' : 'SMS'} ✓</p>
          ) : (
              <p className="otp-hint">This code expires in 10 minutes</p>
          )}
        </div>

        {/* Dev debug banner */}
        {devOtp && (
            <div className="otp-dev-banner">
              <span className="otp-dev-label">Dev</span>
              Your code: <strong>{devOtp}</strong>
            </div>
        )}

        <div className="otp-ctas">
          <button
              className="btn-primary"
              onClick={() => { void handleVerify() }}
              disabled={loading || code.length < OTP_LENGTH}
          >
            {loading
                ? <><Loader2 size={16} className="otp-spin" /> Verifying…</>
                : 'Confirm & Enter'}
          </button>
          <button className="btn-ghost" onClick={() => { void handleResend() }}>
            Resend Code{channel === 'email' ? ' via email' : ' via SMS'}
          </button>
        </div>
      </div>
  )
}
