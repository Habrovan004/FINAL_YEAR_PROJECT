import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Search, Map as MapIcon, List, Loader2, CheckCircle2, MapPin, Calendar, Plus, Minus, Info, AlertCircle, HeartPulse, Bell, Volume2, Type } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import api from '../../api/client'
import { setAccessToken } from '../../api/tokenStore'
import { useTranslation } from 'react-i18next'
import './OnboardingFlow.css'
import './auth.css'

import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
})
L.Marker.prototype.options.icon = DefaultIcon

const TOTAL_STEPS = 7

interface Hospital {
  id: number; name: string; type: string; phone: string; address: string;
  latitude: number; longitude: number; services: string; distance_km?: number;
}

interface SymptomEntry {
  name: string;
  severity: 'mild' | 'moderate' | 'severe';
}

type SignupRole = 'patient' | 'provider'

interface FormData {
  full_name: string; date_of_birth: string; phone_number: string; password: string
  email: string; user_type: SignupRole; specialization: string
  pregnancy_status: string; lmp_date: string; due_date: string
  is_first_pregnancy: boolean; previous_pregnancies: number; previous_complications: string[]
  weight_kg: string; height_cm: string; initial_symptoms: SymptomEntry[]
  hospital: string; language: string
  notifications_enabled: boolean; audio_guidance: boolean; font_size: 'small' | 'medium' | 'large'
}

type FormDataValue = string | number | boolean | string[] | SymptomEntry[];

const SYMPTOMS = ['Nausea', 'Fatigue', 'Headache', 'Swelling', 'Back pain', 'Cravings', 'Heartburn']
const COMPLICATIONS = ['None', 'High Blood Pressure', 'Gestational Diabetes', 'Miscarriage', 'Premature Birth', 'C-section', 'Excessive Bleeding', 'Other']
const DEFAULT_LOCATION: [number, number] = [-6.7924, 39.2083]
const FALLBACK_HOSPITALS: Hospital[] = [
  { id: 1, name: 'Mwananyamala Hospital', type: 'public', phone: '+255 22 276 1781', address: 'Kinondoni, Dar es Salaam', latitude: -6.7724, longitude: 39.2383, services: 'ANC, maternity, emergency', distance_km: 1.2 },
  { id: 2, name: 'Sinza Hospital', type: 'public', phone: '+255 22 246 1000', address: 'Sinza, Dar es Salaam', latitude: -6.7824, longitude: 39.2283, services: 'ANC, maternity', distance_km: 2.4 },
  { id: 3, name: 'CCBRT Hospital', type: 'private', phone: '+255 22 260 2192', address: 'Msasani, Dar es Salaam', latitude: -6.7924, longitude: 39.2483, services: 'Maternal care, specialist care', distance_km: 3.1 },
  { id: 4, name: 'Marie Stopes Tanzania', type: 'private', phone: '+255 22 277 4991', address: 'Kinondoni Road, Dar es Salaam', latitude: -6.8024, longitude: 39.2183, services: 'Reproductive health, family planning', distance_km: 3.8 },
  { id: 5, name: 'Muhimbili National Hospital', type: 'public', phone: '+255 22 215 1367', address: 'Upanga, Dar es Salaam', latitude: -6.8124, longitude: 39.2683, services: 'ANC, maternity, emergency, referral care', distance_km: 4.5 },
  { id: 6, name: 'Aga Khan Hospital', type: 'private', phone: '+255 22 211 5151', address: 'Ocean Road, Dar es Salaam', latitude: -6.8224, longitude: 39.2783, services: 'ANC, maternity, emergency', distance_km: 5.2 },
]
const PREFERENCE_CONFIG = [
  { key: 'notifications_enabled' as const, titleKey: 'notifications', subtitle: 'Weekly tips & reminders', icon: 'bell' },
  { key: 'audio_guidance' as const, titleKey: 'audio_guidance', subtitle: 'Voice-based learning', icon: 'volume' },
]


interface AxiosError {
  response?: { data?: any; status?: number }
}

type FieldErrorMap = Partial<Record<'full_name' | 'email' | 'phone_number' | 'password' | 'hospital' | 'general', string>>

export default function OnboardingFlow() {
  const nav = useNavigate()
  const { i18n, t } = useTranslation()
  const { setUser } = useAuth()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>({
    full_name: '', date_of_birth: '', phone_number: '', password: '',
    email: '', user_type: 'patient', specialization: 'nurse',
    pregnancy_status: 'pregnant', lmp_date: '', due_date: '',
    is_first_pregnancy: true, previous_pregnancies: 0, previous_complications: [],
    weight_kg: '', height_cm: '', initial_symptoms: [],
    hospital: '', language: i18n.language,
    notifications_enabled: true, audio_guidance: false, font_size: 'medium',
  })

  const [loading, setLoading] = useState(false)
  const [dateMode, setDateMode] = useState<'lmp' | 'due_date'>('lmp')
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'public' | 'private'>('all')
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [fetchingHospitals, setFetchingHospitals] = useState(false)
  const [hospitalFetchError, setHospitalFetchError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({})
  const [submitError, setSubmitError] = useState('')
  const submitLockRef = useRef(false)

  const fetchHospitals = useCallback(async (loc: [number, number]) => {
    setFetchingHospitals(true)
    setHospitalFetchError('')
    try {
      const res = await api.get(`/hospitals/?lat=${loc[0]}&lng=${loc[1]}`)
      const list = Array.isArray(res.data) ? res.data : []
      setHospitals(list.length ? list : FALLBACK_HOSPITALS)
    } catch {
      setHospitals(FALLBACK_HOSPITALS)
      setHospitalFetchError('Showing default Dar es Salaam hospitals.')
    }
    finally { setFetchingHospitals(false) }
  }, [])

  useEffect(() => {
    let cancelled = false

    if (step === 6) {
      // Always start with the default location so hospitals load immediately,
      // even if the user denies geolocation or the browser stalls on the prompt.
      void fetchHospitals(DEFAULT_LOCATION)

      // Then upgrade to the precise location in the background, if available.
      if (window.navigator.geolocation) {
        window.navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (cancelled) return
              const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude]
              void fetchHospitals(loc)
            },
            () => { /* ignore — default already loaded */ },
            { timeout: 8000 }
        )
      }
    }

    return () => { cancelled = true }
  }, [step, fetchHospitals])

  const update = (key: keyof FormData, val: FormDataValue) => {
    setForm(p => ({ ...p, [key]: val }))
    if (key === 'full_name' || key === 'email' || key === 'phone_number' || key === 'password') {
      setFieldErrors(prev => ({ ...prev, [key]: undefined, general: undefined }))
      setSubmitError('')
    }
    if (key === 'hospital') {
      setFieldErrors(prev => ({ ...prev, hospital: undefined, general: undefined }))
      setSubmitError('')
    }
  }

  const toggleSymptom = (name: string) => {
    const existing = form.initial_symptoms.find(s => s.name === name)
    if (existing) {
      update('initial_symptoms', form.initial_symptoms.filter(s => s.name !== name))
    } else {
      update('initial_symptoms', [...form.initial_symptoms, { name, severity: 'mild' }])
    }
  }

  const updateSymptomSeverity = (name: string, severity: 'mild' | 'moderate' | 'severe') => {
    update('initial_symptoms', form.initial_symptoms.map(s => s.name === name ? { ...s, severity } : s))
  }

  const toggleArr = (key: keyof FormData, val: string) => {
    const arr = form[key] as string[]
    update(key, arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  const calculateDates = (date: string, mode: 'lmp' | 'due_date') => {
    if (!date) return
    const d = new Date(date); if (isNaN(d.getTime())) return
    let lmp: Date, due: Date; const MS_PER_DAY = 24 * 60 * 60 * 1000
    if (mode === 'lmp') { lmp = d; due = new Date(lmp.getTime() + 280 * MS_PER_DAY) }
    else { due = d; lmp = new Date(due.getTime() - 280 * MS_PER_DAY) }
    update('lmp_date', lmp.toISOString().split('T')[0]); update('due_date', due.toISOString().split('T')[0])
  }

  const handleFinish = async () => {
    // State updates are async; use a ref lock to prevent rapid double-submit.
    if (submitLockRef.current) return
    submitLockRef.current = true
    setLoading(true)
    setSubmitError('')
    setFieldErrors({})
    try {
      if (!form.phone_number || !form.full_name || !form.password) {
        setStep(1)
        setFieldErrors({
          full_name: !form.full_name ? 'Full name is required.' : undefined,
          phone_number: !form.phone_number ? 'Phone number is required.' : undefined,
          password: !form.password ? 'Password is required.' : undefined,
        })
        setSubmitError('Please complete your account details first.')
        return
      }

      const payload: any = {
        phone_number: form.phone_number,
        full_name: form.full_name,
        email: form.email || null,
        date_of_birth: form.date_of_birth || null,
        password: form.password,
        user_type: form.user_type,
      }
      if (form.user_type !== 'patient') {
        payload.hospital_id = form.hospital ? parseInt(form.hospital) : null
      }
      if (form.user_type === 'provider') {
        payload.specialization = form.specialization
      }

      const { data: regData } = await api.post('/auth/register/', payload)
      setAccessToken(regData.access)

      let finalUser = regData.user

      if (form.user_type === 'patient') {
        try {
          const { data: onboardData } = await api.post('/patients/complete-onboarding/', {
            pregnancy_status: form.pregnancy_status,
            lmp_date: form.lmp_date || null,
            due_date: form.due_date || null,
            is_first_pregnancy: form.is_first_pregnancy,
            previous_pregnancies: form.previous_pregnancies,
            previous_complications: form.previous_complications,
            weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
            height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
            initial_symptoms: form.initial_symptoms,
            hospital_id: form.hospital ? parseInt(form.hospital) : null,
            language: i18n.language,
            notifications_enabled: form.notifications_enabled,
            audio_guidance: form.audio_guidance,
            font_size: form.font_size,
          })
          finalUser = onboardData
        } catch {
          // Non-fatal — profile visible in settings
        }
      }

      setUser(finalUser)

      if (form.user_type === 'provider') {
        nav('/provider/dashboard')
      } else {
        nav('/home')
      }
    } catch (err) {
      const axiosErr = err as AxiosError
      const data = axiosErr.response?.data
      let msg = 'Error completing setup'
      const nextErrors: FieldErrorMap = {}
      if (axiosErr.response?.status === 429) {
        msg = 'Too many attempts from this device. Please wait a few minutes and try again.'
      } else if (data) {
        if (typeof data === 'string') {
          msg = data.slice(0, 100)
        } else if (typeof data.detail === 'string') {
          msg = data.detail
        } else if (data.error) {
          msg = data.error
        } else {
          if (Array.isArray(data.phone_number) && data.phone_number[0]) nextErrors.phone_number = String(data.phone_number[0])
          if (Array.isArray(data.full_name) && data.full_name[0]) nextErrors.full_name = String(data.full_name[0])
          if (Array.isArray(data.password) && data.password[0]) nextErrors.password = String(data.password[0])
          if (Array.isArray(data.email) && data.email[0]) nextErrors.email = String(data.email[0])
          if (Array.isArray(data.hospital_id) && data.hospital_id[0]) nextErrors.hospital = String(data.hospital_id[0])

          if (nextErrors.phone_number) msg = `Phone number: ${nextErrors.phone_number}`
          else if (nextErrors.hospital) msg = nextErrors.hospital
          else {
            const firstKey = Object.keys(data)[0]
            if (firstKey && Array.isArray(data[firstKey])) msg = `${firstKey}: ${data[firstKey][0]}`
          }
        }
      }
      setFieldErrors(nextErrors)
      if (!Object.keys(nextErrors).length) {
        setFieldErrors({ general: msg })
      }
      setSubmitError(msg)
    } finally {
      submitLockRef.current = false
      setLoading(false)
    }
  }

  const next = () => {
    // Validation for Step 1
    if (step === 1) {
       if (!form.full_name || !form.phone_number || !form.password) {
          alert("Please fill in all account details.");
          return;
       }
       if (form.password.length < 6) {
          alert("Password must be at least 6 characters.");
          return;
       }
       // Non-mothers skip pregnancy-related steps and jump to facility pick
       if (form.user_type !== 'patient') {
         setStep(6);
         return;
       }
    }

    if (step === 2) {
      if (form.pregnancy_status === 'not_now') { setStep(7); return; }
      if (form.pregnancy_status === 'planning') { setStep(3); return; }
    }

    if (step === 5) {
      const w = parseFloat(form.weight_kg);
      const h = parseFloat(form.height_cm);
      if (isNaN(w) || w < 30 || w > 200 || isNaN(h) || h < 100 || h > 220) {
        alert("Please enter a valid weight (30-200kg) and height (100-220cm).");
        return;
      }
    }

    // Non-mothers submit directly after facility pick
    if (step === 6 && form.user_type !== 'patient') {
      if (!form.hospital) {
        alert('Please select your facility.')
        return
      }
      void handleFinish()
      return
    }

    if (step === TOTAL_STEPS) {
      void handleFinish()
      return
    }

    if (step < TOTAL_STEPS) setStep(s => s + 1)
  }

  const back = () => {
    if (step === 6 && form.user_type !== 'patient') { setStep(1); return; }
    if (step === 7 && form.pregnancy_status === 'not_now') { setStep(2); return; }
    if (step > 1) {
      setStep(s => s - 1)
    } else {
      nav('/')
    }
  }

  const progress = (step / TOTAL_STEPS) * 100
  const formatDateLabel = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  // Hospital Logic
  const hospitalList = Array.isArray(hospitals) ? hospitals : []
  const filteredHospitals = hospitalList.filter(h => {
    if (!h || !h.name) return false
    const addr = h.address || ''
    const matchesSearch = h.name.toLowerCase().includes(search.toLowerCase()) || addr.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === 'all' || (h.type || '').toLowerCase() === typeFilter
    return matchesSearch && matchesType
  }).sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0))

  const weightVal = parseFloat(form.weight_kg)
  const heightVal = parseFloat(form.height_cm) / 100
  const bmi = (weightVal > 0 && heightVal > 0) ? (weightVal / (heightVal * heightVal)).toFixed(1) : null

  const getBmiStatus = (val: number) => {
    if (val < 18.5) return { label: 'Underweight', color: 'text-blue-500' }
    if (val <= 24.9) return { label: 'Normal Weight', color: 'text-green-500' }
    if (val <= 29.9) return { label: 'Overweight', color: 'text-orange-500' }
    return { label: 'Obese', color: 'text-red-500' }
  }

  const isWeightValid = !form.weight_kg || (parseFloat(form.weight_kg) >= 30 && parseFloat(form.weight_kg) <= 200)
  const isHeightValid = !form.height_cm || (parseFloat(form.height_cm) >= 100 && parseFloat(form.height_cm) <= 220)

  return (
      <div className="onboarding-page">
        <header className="ob-header">
          <button onClick={back} className="back-btn"><ArrowLeft size={18} /></button>
          <div className="ob-progress-wrap" aria-label={`Step ${step} of ${TOTAL_STEPS}`}>
            <div className="ob-progress-meta">
              <span>Step {step}</span>
              <span>{TOTAL_STEPS}</span>
            </div>
            <div className="ob-progress-track"><div className="ob-progress-fill" style={{ width: `${progress}%` }} /></div>
          </div>
        </header>

        <main className="ob-content">
          {(submitError || fieldErrors.general) && (
            <div className="mb-3 flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold">
              <AlertCircle size={14} />
              {fieldErrors.general || submitError}
            </div>
          )}
          {step === 1 && (
              <>
                <div className="ob-titles"><span className="ob-eyebrow">Account</span><h2 className="ob-title">{t('setup_account')}</h2><p className="ob-subtitle">{t('details_or')} <Link to="/login">{t('login_here')}</Link></p></div>
                <div className="ob-field-group">
                  <div>
                    <label className="field-label">I am signing up as</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                                              { v: 'patient', label: 'Mother' },
                                            ] as { v: SignupRole; label: string }[]).map(r => (
                                              <button
                                                key={r.v}
                                                type="button"
                                                onClick={() => update('user_type', r.v)}
                                                className={`field-input text-center text-[11px] font-bold ${form.user_type === r.v ? 'bg-rose-50 border-rose-400 text-rose-500' : ''}`}
                                                style={{ padding: '10px 4px' }}
                                              >{r.label}</button>
                                            ))}
                    </div>
                  </div>
                  <div><label className="field-label" htmlFor="full_name">{t('full_name')}</label><input id="full_name" className={`field-input ${fieldErrors.full_name ? 'border-red-400' : ''}`} placeholder="e.g. Amani Wanjiku" value={form.full_name} onChange={e => update('full_name', e.target.value)} />{fieldErrors.full_name && <p className="ob-inline-error"><AlertCircle size={10} /> {fieldErrors.full_name}</p>}</div>
                  <div><label className="field-label" htmlFor="email">Email <span className="text-gray-400">(optional)</span></label><input id="email" className={`field-input ${fieldErrors.email ? 'border-red-400' : ''}`} type="email" placeholder="you@example.com" value={form.email} onChange={e => update('email', e.target.value)} />{fieldErrors.email && <p className="ob-inline-error"><AlertCircle size={10} /> {fieldErrors.email}</p>}</div>
                  {form.user_type === 'patient' && (
                    <div><label className="field-label" htmlFor="dob">{t('dob')}</label><input id="dob" className="field-input" type="date" value={form.date_of_birth} onChange={e => update('date_of_birth', e.target.value)} /></div>
                  )}
                  {form.user_type === 'provider' && (
                    <div>
                      <label className="field-label">Specialization</label>
                      <select className="field-input" value={form.specialization} onChange={e => update('specialization', e.target.value)}>
                        <option value="nurse">Nurse Practitioner</option>
                        <option value="midwife">Midwife</option>
                        <option value="obstetrician">Obstetrician</option>
                      </select>
                    </div>
                  )}
                  <div><label className="field-label" htmlFor="phone">{t('phone_number')}</label><input id="phone" className={`field-input ${fieldErrors.phone_number ? 'border-red-400' : ''}`} placeholder="+255 712 345 678" value={form.phone_number} onChange={e => update('phone_number', e.target.value)} />{fieldErrors.phone_number && <p className="ob-inline-error"><AlertCircle size={10} /> {fieldErrors.phone_number}</p>}</div>
                  <div><label className="field-label" htmlFor="password">{t('password')}</label><input id="password" className={`field-input ${fieldErrors.password ? 'border-red-400' : ''}`} type="password" placeholder="Min 6 characters" value={form.password} onChange={e => update('password', e.target.value)} />{fieldErrors.password && <p className="ob-inline-error"><AlertCircle size={10} /> {fieldErrors.password}</p>}</div>
                </div>
              </>
          )}

          {step === 2 && (
              <>
                <div className="ob-titles"><span className="ob-eyebrow">Care path</span><h2 className="ob-title">{t('pregnant_q')}</h2><p className="ob-subtitle">{t('pregnant_sub')}</p></div>
                <div className="ob-options">
                  {[
                    { v: 'pregnant', t: t('yes_pregnant'), s: 'Personalized care for your stage.' },
                    { v: 'planning', t: t('planning_preg'), s: 'Tips while you prepare.' },
                    { v: 'not_now', t: t('not_now'), s: 'Explore at your own pace.' }
                  ].map(o => (
                      <button key={o.v} onClick={() => update('pregnancy_status', o.v)} className={`ob-option ${form.pregnancy_status === o.v ? 'active' : ''}`}>
                        <p className="ob-option-title">{o.t}</p><p className="ob-option-sub">{o.s}</p>
                      </button>
                  ))}
                </div>
              </>
          )}

          {step === 3 && (
              <>
                <div className="ob-titles">
                  <span className="ob-eyebrow">Timeline</span><h2 className="ob-title">{form.pregnancy_status === 'planning' ? 'Preparation' : t('timing_title')}</h2>
                  <p className="ob-subtitle">{form.pregnancy_status === 'planning' ? "We'll provide tips to help you prepare." : t('timing_sub')}</p>
                </div>
                {form.pregnancy_status === 'pregnant' ? (
                  <>
                    <div className="ob-segment"><button onClick={() => setDateMode('lmp')} className={`ob-seg-btn ${dateMode === 'lmp' ? 'active' : ''}`}>{t('last_period')}</button><button onClick={() => setDateMode('due_date')} className={`ob-seg-btn ${dateMode === 'due_date' ? 'active' : ''}`}>{t('due_date')}</button></div>
                    <div className="relative"><Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-300" size={18} /><input className="field-input pl-12" type="date" value={dateMode === 'lmp' ? form.lmp_date : form.due_date} onChange={e => calculateDates(e.target.value, dateMode)} /></div>
                    {(form.lmp_date || form.due_date) && (<div className="ob-dates-pill">{dateMode === 'lmp' ? <p>Estimated Due Date: <strong>{formatDateLabel(form.due_date)}</strong></p> : <p>Calculated Last Period: <strong>{formatDateLabel(form.lmp_date)}</strong></p>}</div>)}
                  </>
                ) : (
                  <div className="ob-note-card"><HeartPulse size={20} /><p>You'll receive personalized nutrition and vitamin tips to help your body prepare for a healthy pregnancy.</p></div>
                )}
              </>
          )}

          {step === 4 && (
              <>
                <div className="ob-titles"><span className="ob-eyebrow">Health background</span><h2 className="ob-title">Pregnancy history</h2><p className="ob-subtitle">Your history helps us provide safer guidance.</p></div>
                <div className="ob-options"><button onClick={() => update('is_first_pregnancy', true)} className={`ob-option ${form.is_first_pregnancy ? 'active' : ''}`}><p className="ob-option-title">First Pregnancy</p><p className="ob-option-sub">We'll guide you step-by-step.</p></button><button onClick={() => { update('is_first_pregnancy', false); if (form.previous_pregnancies === 0) update('previous_pregnancies', 1); }} className={`ob-option ${!form.is_first_pregnancy ? 'active' : ''}`}><p className="ob-option-title">Not My First</p><p className="ob-option-sub">Tell us about your history.</p></button></div>
                {!form.is_first_pregnancy && (
                    <div className="fade-up"><div className="ob-divider" /><p className="ob-section-label">Previous Pregnancies</p><div className="ob-stepper-container"><button onClick={() => update('previous_pregnancies', Math.max(1, (form.previous_pregnancies as number) - 1))} className="ob-counter-btn"><Minus size={18} /></button><span className="ob-counter-value">{form.previous_pregnancies}</span><button onClick={() => update('previous_pregnancies', (form.previous_pregnancies as number) + 1)} className="ob-counter-btn plus"><Plus size={18} /></button></div><div className="ob-divider" /><p className="ob-section-label">Any complications before? <span>(Select all)</span></p><div className="ob-chips-grid">{COMPLICATIONS.map(c => (<button key={c} onClick={() => toggleArr('previous_complications', c)} className={`ob-chip ${form.previous_complications.includes(c) ? 'active' : ''}`}>{c}</button>))}</div></div>
                )}
              </>
          )}

          {step === 5 && (
              <>
                <div className="ob-titles"><span className="ob-eyebrow">Wellness profile</span><h2 className="ob-title">Body measurements</h2><p className="ob-subtitle">Helps us tailor weekly health tips.</p></div>
                <div className="space-y-6">
                  <section><p className="ob-section-label mt-0">Physical Measurements</p><div className="ob-grid-2"><div><label className="field-label" htmlFor="weight">Weight (kg)</label><input id="weight" className={`field-input ${!isWeightValid ? 'border-red-400' : ''}`} type="number" placeholder="62" value={form.weight_kg} onChange={e => update('weight_kg', e.target.value)} />{!isWeightValid && <p className="ob-inline-error"><AlertCircle size={10} /> Must be 30-200kg</p>}</div><div><label className="field-label" htmlFor="height">Height (cm)</label><input id="height" className={`field-input ${!isHeightValid ? 'border-red-400' : ''}`} type="number" placeholder="165" value={form.height_cm} onChange={e => update('height_cm', e.target.value)} />{!isHeightValid && <p className="ob-inline-error"><AlertCircle size={10} /> Must be 100-220cm</p>}</div></div>{bmi && isWeightValid && isHeightValid && (<div className="ob-bmi-card"><div><p className="ob-bmi-label">Calculated BMI</p><p className={`ob-bmi-value ${getBmiStatus(parseFloat(bmi)).color}`}>{bmi} <span>{getBmiStatus(parseFloat(bmi)).label}</span></p></div><div className="ob-bmi-icon"><Info size={16} /></div></div>)}</section>
                  <section><p className="ob-section-label">Current Symptoms <span>(Select to set severity)</span></p><div className="ob-chips-grid">{SYMPTOMS.map(s => { const active = form.initial_symptoms.find(x => x.name === s); return ( <div key={s} className="flex flex-col gap-2"><button onClick={() => toggleSymptom(s)} className={`ob-chip ${active ? 'active' : ''}`}>{s}</button>{active && (<div className="flex gap-1 bg-rose-50 p-1 rounded-lg animate-in zoom-in-95 duration-200">{(['mild', 'moderate', 'severe'] as const).map(sev => (<button key={sev} onClick={() => updateSymptomSeverity(s, sev)} className={`flex-1 text-[8px] font-bold uppercase py-1 px-1.5 rounded-md transition-all ${active.severity === sev ? 'bg-rose-400 text-white shadow-sm' : 'text-rose-300 hover:bg-rose-100'}`}>{sev}</button>))}</div>)}</div> ) })}</div></section>
                </div>
              </>
          )}

          {step === 6 && (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex items-center justify-between mb-4"><div className="ob-titles mb-0"><span className="ob-eyebrow">Care facility</span><h2 className="ob-title" style={{ fontSize: '22px' }}>Select Hospital</h2><p className="ob-subtitle">Find your ANC facility</p></div><button onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')} className="ob-view-toggle">{viewMode === 'list' ? <MapIcon size={18} /> : <List size={18} />}</button></div>
                
                <div className="ob-search-wrap"><Search className="ob-search-icon" size={16} /><input className="ob-search-input" placeholder="Search name or area..." value={search} onChange={e => setSearch(e.target.value)} /></div>

                <div className="ob-filter-chips">
                  {(['all', 'public', 'private'] as const).map(f => (
                    <button key={f} onClick={() => setTypeFilter(f)} className={`ob-filter-chip ${typeFilter === f ? 'active' : ''}`}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
                  ))}
                </div>

                {fetchingHospitals ? (<div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-rose-400" /></div>) : (
                    <div className="ob-hospital-list custom-scrollbar">
                        {fieldErrors.hospital && (
                          <div className="ob-selected-later" style={{ borderColor: '#fecaca', color: '#dc2626' }}>
                            <AlertCircle size={16} />
                            <span>{fieldErrors.hospital}</span>
                          </div>
                        )}
                        {filteredHospitals.length === 0 && (
                          <div className="ob-empty-state">
                            <MapPin size={22} />
                            <p>No hospitals match your filters.</p>
                            <span>Try another search term or switch the public/private filter.</span>
                          </div>
                        )}
                        {hospitalFetchError && filteredHospitals.length > 0 && (
                          <div className="ob-selected-later">
                            <Info size={16} />
                            <span>{hospitalFetchError}</span>
                          </div>
                        )}
                        {filteredHospitals.map(h => {
                          const hType = (h.type || 'public').toLowerCase()
                          return (
                          <button key={h.id} onClick={() => update('hospital', h.id.toString())} className={`ob-hospital-card ${form.hospital === h.id.toString() ? 'active' : ''}`}>
                            <div className="ob-h-top">
                              <p className="ob-h-name">{h.name}</p>
                              <span className={`ob-h-badge ${hType}`}>{h.type || 'public'}</span>
                            </div>
                            <div className="ob-h-meta"><MapPin size={10} /> {h.address || ''}</div>
                            <div className="flex items-center justify-between">
                              <p className="ob-h-dist">{h.distance_km != null ? `${h.distance_km} km away` : ''}</p>
                              {form.hospital === h.id.toString() && <CheckCircle2 size={16} className="text-rose-500" />}
                            </div>
                          </button>
                          )
                        })}
                    </div>
                )}
              </div>
          )}

          {step === 7 && (
              <>
                <div className="ob-titles"><span className="ob-eyebrow">Preferences</span><h2 className="ob-title">{t('preferences_title')}</h2><p className="ob-subtitle">{t('preferences_sub')}</p></div>
                <div className="ob-pref-list">
                  {PREFERENCE_CONFIG.map(p => (
                      <div key={p.key} className="ob-pref-card"><div className="ob-pref-icon">{p.icon === 'bell' ? <Bell size={18} /> : <Volume2 size={18} />}</div><div className="ob-pref-info"><p className="ob-pref-title">{t(p.titleKey)}</p><p className="ob-pref-sub">{p.subtitle}</p></div><button onClick={() => update(p.key, !form[p.key])} className={`ob-toggle ${form[p.key] ? 'on' : 'off'}`}><div className="ob-toggle-thumb" /></button></div>
                  ))}
                  <div className="ob-divider" />
                  <p className="ob-section-label mt-0"><Type size={13} /> {t('font_size')}</p>
                  <div className="ob-segment">{(['small', 'medium', 'large'] as const).map(size => (<button key={size} onClick={() => update('font_size', size)} className={`ob-seg-btn ${form.font_size === size ? 'active' : ''}`}>{size.charAt(0).toUpperCase() + size.slice(1)}</button>))}</div>
                </div>
              </>
          )}

          <div className="ob-cta">
            <button
              className="btn-primary"
              onClick={next}
              disabled={
                loading ||
                !isWeightValid ||
                !isHeightValid ||
                (step === 6 && !form.hospital)
              }
            >
              {loading ? <Loader2 className="ob-spin" size={18} /> : t('continue')}
            </button>
          </div>
        </main>
      </div>
  )
}
