import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '../../api/client'
import { ArrowLeft } from 'lucide-react'
import './auth.css'

interface LocationState { phoneNumber?: string; devOtp?: string }

export default function PasswordResetConfirm(){
  const nav = useNavigate()
  const location = useLocation()
  const { phoneNumber, devOtp } = (location.state as LocationState) || { phoneNumber: '', devOtp: undefined }

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
    if (!codeIsValid) { setLoading(false); setError('Enter the 6-digit code you received.'); return }
    if (!passwordIsValid) { setLoading(false); setError('Password must be at least 8 characters.'); return }
    if (!passwordsMatch) { setLoading(false); setError('Passwords do not match.'); return }
    try{
      await api.post('/auth/password-reset/confirm/', { phone_number: phone, code, new_password: newPass })
      setSuccess('Password reset successful. Redirecting to login...')
      setTimeout(()=> nav('/login'), 1500)
    }catch(err: unknown){
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setError(axiosErr?.response?.data?.error || 'Could not reset password')
    }finally{ setLoading(false) }
  }

  return (
    <div className="auth-page">
      <div className="login-header">
        <button onClick={() => nav('/password-reset/request')} className="back-btn" aria-label="Go back">
          <ArrowLeft size={18} />
        </button>
      </div>
      <h1>Set new password</h1>
      <p>Enter the code you received and choose a new password.</p>
      <form onSubmit={(e)=>{ void handleConfirm(e) }} className="auth-form">
        <label>Phone number</label>
        <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="0712345678" required />

        <label>Code</label>
        <input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" inputMode="numeric" required />

        <label>New password</label>
        <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="New password" required />

        <label>Confirm password</label>
        <input type="password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} placeholder="Confirm new password" required />

        {error && <p className="auth-error">{error}</p>}
        {success && <p className="auth-success">{success}</p>}

        <div className="auth-ctas">
          <button className="btn-primary" type="submit" disabled={loading || !codeIsValid || !passwordIsValid || !passwordsMatch}>{loading ? 'Saving...' : 'Set password'}</button>
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

