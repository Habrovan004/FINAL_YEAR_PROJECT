import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import { ArrowLeft } from 'lucide-react'
import './auth.css'

export default function PasswordResetRequest(){
  const nav = useNavigate()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const phoneIsValid = /^0?7\d{8}$/.test(phone.replace(/\s+/g, '')) || /^\+?2557\d{8}$/.test(phone.replace(/\s+/g, ''))

  const handleRequest = async (e: React.FormEvent) =>{
    e.preventDefault()
    if (!phoneIsValid) {
      setError('Enter a valid Tanzanian phone number.')
      return
    }
    setLoading(true); setError(''); setDevOtp(null)
    try{
      const { data } = await api.post('/auth/password-reset/request/', { phone_number: phone })
      if(data.dev_otp) setDevOtp(data.dev_otp)
      // navigate to confirm page with phone in state
      nav('/password-reset/confirm', { state: { phoneNumber: phone, devOtp: data.dev_otp } })
    }catch(err: unknown){
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setError(axiosErr?.response?.data?.error || 'Could not send reset code')
    }finally{ setLoading(false) }
  }

  return (
    <div className="auth-page">
      <div className="login-header">
        <button onClick={() => nav('/login')} className="back-btn" aria-label="Go back to login">
          <ArrowLeft size={18} />
        </button>
      </div>
      <h1>Reset password</h1>
      <p>Enter your phone number to receive a reset code via SMS.</p>
      <form onSubmit={(e)=>{ void handleRequest(e) }} className="auth-form">
        <label>Phone number</label>
        <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="e.g. 0712345678 or +255712345678" required />
        {error && <p className="auth-error">{error}</p>}
        <div className="auth-ctas">
          <button className="btn-primary" type="submit" disabled={loading || !phoneIsValid}>{loading ? 'Sending...' : 'Send code'}</button>
          <button className="btn-ghost" type="button" onClick={() => nav('/login')}>Back to login</button>
        </div>
      </form>
      {devOtp && (
        <div className="otp-dev-banner">
          <span className="otp-dev-label">Dev</span>
          Code: <strong>{devOtp}</strong>
        </div>
      )}
    </div>
  )
}

