import { useState, useEffect } from 'react'
import { ArrowLeft, Clock, Building2, ChevronDown, CalendarPlus, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'

interface Appointment {
  id: number
  visit_type: string
  visit_type_display: string
  appointment_date: string
  appointment_time: string
  hospital_name: string
  status: string
  notes: string
  what_to_bring: string
}

// The 'completed' tab is a frontend-only label — the backend's actual filter
// vocabulary is upcoming/history/requested (there's no 'completed' status).
const BACKEND_FILTER: Record<'upcoming' | 'completed', string> = {
  upcoming: 'upcoming',
  completed: 'history',
}

type TabKey = 'upcoming' | 'completed' | 'book'

export default function AppointmentsPage() {
  const nav = useNavigate()
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const locale = i18n.language?.startsWith('sw') ? 'sw-TZ' : 'en-US'

  const [tab, setTab] = useState<TabKey>('upcoming')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cancellingId, setCancellingId] = useState<number | null>(null)

  const canBookAppointment = user?.user_type !== 'patient' || user?.has_assigned_provider !== false

  const fetchAppointments = async () => {
    setLoading(true)
    setError('')
    try {
      const backendFilter = BACKEND_FILTER[tab as 'upcoming' | 'completed']
      const response = await api.get(`/appointments/?filter=${backendFilter}`)
      setAppointments(response.data)
    } catch (e) {
      console.error('Error fetching appointments:', e)
      setError(t('appts_err_load'))
    } finally {
      setLoading(false)
    }
  }

  const cancelAppointment = async (id: number) => {
    if (!window.confirm(t('appts_cancel_confirm'))) return
    setCancellingId(id)
    try {
      await api.patch(`/appointments/${id}/`, { status: 'cancelled' })
      await fetchAppointments()
    } catch (e) {
      console.error('Error cancelling appointment:', e)
      setError(t('appts_err_save'))
    } finally {
      setCancellingId(null)
    }
  }

  useEffect(() => {
    if (tab !== 'book') {
      fetchAppointments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })

  const formatTime = (raw: string) => {
    try {
      const [h, m] = raw.split(':')
      const date = new Date()
      date.setHours(parseInt(h), parseInt(m))
      return date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
    } catch {
      return raw
    }
  }

  const tabLabel = (key: TabKey) => {
    if (key === 'upcoming') return t('appts_tab_upcoming')
    if (key === 'completed') return t('appts_tab_completed')
    return t('appts_tab_book')
  }

  const statusLabel = (status: string) => {
    if (status === 'requested') return t('appts_status_requested')
    if (status === 'upcoming') return t('appts_status_upcoming')
    if (status === 'completed') return t('appts_status_completed')
    if (status === 'cancelled') return t('appts_status_cancelled')
    return status
  }

  return (
    <div className="appointments-screen min-h-screen pb-24 bg-[#faf9f7] flex justify-center">
      <div className="w-full max-w-lg p-5">
        <header className="flex items-center justify-between mb-6">
          <button
            onClick={() => nav('/home')}
            className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center"
            aria-label={t('back')}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">{t('appts_title')}</h1>
          <div className="w-10" />
        </header>

        <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-6">
          {(['upcoming', 'completed', 'book'] as const).map(tk => (
            <button
              key={tk}
              onClick={() => setTab(tk)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold capitalize transition-all ${
                tab === tk ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'
              }`}
            >
              {tabLabel(tk)}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 text-red-500 rounded-xl text-xs font-bold">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-rose-400" />
          </div>
        ) : tab !== 'book' ? (
          <div className="space-y-4">
            {appointments.map(a => (
              <div key={a.id} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 relative overflow-hidden">
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                  a.status === 'requested' ? 'bg-amber-400' : a.status === 'upcoming' ? 'bg-rose-400' : 'bg-green-400'
                }`} />

                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{a.visit_type_display}</p>
                    <h3 className="font-bold text-lg mt-0.5">{formatDate(a.appointment_date)}</h3>
                  </div>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase ${
                    a.status === 'requested' ? 'bg-amber-50 text-amber-600'
                      : a.status === 'upcoming' ? 'bg-rose-50 text-rose-500' : 'bg-green-50 text-green-500'
                  }`}>
                    {statusLabel(a.status)}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs font-semibold text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <Clock size={14} className="text-rose-300" />{formatTime(a.appointment_time)}
                  </span>
                  {a.hospital_name && (
                    <span className="flex items-center gap-1.5">
                      <Building2 size={14} className="text-rose-300" />{a.hospital_name}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                  className="mt-4 w-full flex items-center justify-between text-xs font-bold text-gray-600 bg-gray-50 rounded-xl px-4 py-3 active:bg-gray-100 transition-colors"
                >
                  {t('appts_prep_guide')}
                  <ChevronDown size={14} className={`transition-transform duration-300 ${expanded === a.id ? 'rotate-180' : ''}`} />
                </button>

                {(a.status === 'requested' || a.status === 'upcoming') && (
                  <button
                    onClick={() => void cancelAppointment(a.id)}
                    disabled={cancellingId === a.id}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs font-bold text-red-500 bg-red-50 rounded-xl px-4 py-2.5 active:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    {cancellingId === a.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                    {t('appts_cancel')}
                  </button>
                )}

                {expanded === a.id && (
                  <div className="mt-2 p-4 bg-gray-50 rounded-2xl animate-in slide-in-from-top-2 duration-300">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">{t('appts_checklist')}</p>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                        <CheckCircle2 size={14} className="text-green-400" /> {t('appts_clinic_card')}
                      </li>
                      <li className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                        <CheckCircle2 size={14} className="text-green-400" /> {t('appts_lab_results')}
                      </li>
                      {a.what_to_bring && a.what_to_bring.split('\n').map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                          <CheckCircle2 size={14} className="text-green-400" /> {item}
                        </li>
                      ))}
                    </ul>
                    {a.notes && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{t('appts_doctor_notes')}</p>
                        <p className="text-xs text-gray-500 italic">"{a.notes}"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {appointments.length === 0 && !error && (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                <CalendarPlus size={40} className="text-gray-200 mb-3" />
                <p className="text-sm font-bold text-gray-400">{t('appts_empty_title')}</p>
                <button onClick={() => setTab('book')} className="text-rose-400 text-xs font-bold mt-2">
                  {t('appts_empty_cta')}
                </button>
              </div>
            )}
          </div>
        ) : (
          user?.user_type === 'provider' ? (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-amber-200">
              <div className="flex items-start gap-3 text-amber-700">
                <AlertCircle size={18} className="mt-0.5" />
                <p className="text-sm font-semibold">{t('appts_provider_use_dashboard')}</p>
              </div>
            </div>
          ) : canBookAppointment ? (
            <BookForm onSaved={() => setTab('upcoming')} />
          ) : (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-amber-200">
              <div className="flex items-start gap-3 text-amber-700">
                <AlertCircle size={18} className="mt-0.5" />
                <p className="text-sm font-semibold">{t('appts_no_provider_assigned')}</p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}

interface ApiError {
  response?: {
    status?: number
    data?: {
      error?: string
      detail?: string
      [key: string]: unknown
    }
  }
}

function BookForm({ onSaved }: { onSaved: () => void }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({
    visit_type: 'anc',
    appointment_date: '',
    appointment_time: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!form.appointment_date || !form.appointment_time) {
      setError(t('appts_err_datetime'))
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.post('/appointments/', form)
      onSaved()
    } catch (e) {
      const err = e as ApiError
      const apiError = err.response?.data?.error || err.response?.data?.detail
      if (typeof apiError === 'string' && apiError.length > 0) {
        if (apiError.includes('assigned a healthcare provider')) {
          setError(t('appts_no_provider_assigned'))
        } else {
          setError(apiError)
        }
      } else {
        setError(t('appts_err_save'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 animate-in fade-in duration-500">
      <div className="space-y-5">
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block pl-1">
            {t('appts_form_reason')}
          </label>
          <select
            className="input-field appearance-none bg-gray-50"
            value={form.visit_type}
            onChange={e => setForm(p => ({ ...p, visit_type: e.target.value }))}
          >
            <option value="anc">{t('appts_visit_anc')}</option>
            <option value="ultrasound">{t('appts_visit_ultrasound')}</option>
            <option value="blood_test">{t('appts_visit_blood')}</option>
            <option value="consultation">{t('appts_visit_consult')}</option>
            <option value="other">{t('appts_visit_other')}</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block pl-1">
              {t('appts_form_date')}
            </label>
            <input
              className="input-field bg-gray-50"
              type="date"
              value={form.appointment_date}
              onChange={e => setForm(p => ({ ...p, appointment_date: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block pl-1">
              {t('appts_form_time')}
            </label>
            <input
              className="input-field bg-gray-50"
              type="time"
              value={form.appointment_time}
              onChange={e => setForm(p => ({ ...p, appointment_time: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block pl-1">
            {t('appts_form_notes')}
          </label>
          <textarea
            className="input-field bg-gray-50 min-h-[100px] resize-none"
            placeholder={t('appts_form_notes_placeholder')}
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-500 rounded-xl text-xs font-bold">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <button className="btn-primary flex items-center justify-center gap-2 mt-4" onClick={save} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" size={20} /> : t('appts_form_submit')}
        </button>
      </div>
    </div>
  )
}
