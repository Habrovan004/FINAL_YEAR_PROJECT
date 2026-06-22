import { useState, useEffect } from 'react'
import { ArrowLeft, Clock, Building2, ChevronDown, CalendarPlus, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'

interface Appointment {
  id: number;
  visit_type: string;
  visit_type_display: string;
  appointment_date: string;
  appointment_time: string;
  hospital_name: string;
  status: string;
  notes: string;
  what_to_bring: string;
}

export default function AppointmentsPage() {
  const nav = useNavigate()
  const [tab, setTab] = useState<'upcoming' | 'completed' | 'book'>('upcoming')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchAppointments = async () => {
    setLoading(true)
    try {
      const response = await api.get(`/appointments/?filter=${tab}`)
      setAppointments(response.data)
    } catch (error) {
      console.error('Error fetching appointments:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tab !== 'book') {
      fetchAppointments()
    }
  }, [tab])

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })
  const formatTime = (t: string) => {
    try {
      const [h, m] = t.split(':')
      const date = new Date()
      date.setHours(parseInt(h), parseInt(m))
      return date.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })
    } catch {
      return t
    }
  }

  return (
    <div className="min-h-screen pb-24 bg-[#faf9f7] flex justify-center">
      <div className="w-full max-w-lg p-5">
        <header className="flex items-center justify-between mb-6">
          <button onClick={() => nav('/home')} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">Clinical Visits</h1>
          <div className="w-10" />
        </header>

        <div className="flex bg-gray-100 p-1.5 rounded-2xl mb-6">
          {(['upcoming', 'completed', 'book'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold capitalize transition-all ${tab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}>
              {t === 'book' ? 'New Visit' : t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-rose-400" /></div>
        ) : tab !== 'book' ? (
          <div className="space-y-4">
            {appointments.map(a => (
              <div key={a.id} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 relative overflow-hidden">
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${a.status === 'upcoming' ? 'bg-rose-400' : 'bg-green-400'}`} />
                
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{a.visit_type_display}</p>
                    <h3 className="font-bold text-lg mt-0.5">{formatDate(a.appointment_date)}</h3>
                  </div>
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase ${a.status === 'upcoming' ? 'bg-rose-50 text-rose-500' : 'bg-green-50 text-green-500'}`}>
                    {a.status}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs font-semibold text-gray-500">
                  <span className="flex items-center gap-1.5"><Clock size={14} className="text-rose-300" />{formatTime(a.appointment_time)}</span>
                  {a.hospital_name && <span className="flex items-center gap-1.5"><Building2 size={14} className="text-rose-300" />{a.hospital_name}</span>}
                </div>

                <button onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                  className="mt-4 w-full flex items-center justify-between text-xs font-bold text-gray-600 bg-gray-50 rounded-xl px-4 py-3 active:bg-gray-100 transition-colors">
                  Preparation Guide <ChevronDown size={14} className={`transition-transform duration-300 ${expanded === a.id ? 'rotate-180' : ''}`} />
                </button>
                
                {expanded === a.id && (
                  <div className="mt-2 p-4 bg-gray-50 rounded-2xl animate-in slide-in-from-top-2 duration-300">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Checklist:</p>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                        <CheckCircle2 size={14} className="text-green-400" /> Maternity Clinic Card
                      </li>
                      <li className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                        <CheckCircle2 size={14} className="text-green-400" /> Previous Lab Results
                      </li>
                      {a.what_to_bring && a.what_to_bring.split('\n').map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                          <CheckCircle2 size={14} className="text-green-400" /> {item}
                        </li>
                      ))}
                    </ul>
                    {a.notes && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Doctor's Notes:</p>
                        <p className="text-xs text-gray-500 italic">"{a.notes}"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {appointments.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                <CalendarPlus size={40} className="text-gray-200 mb-3" />
                <p className="text-sm font-bold text-gray-400">No appointments scheduled</p>
                <button onClick={() => setTab('book')} className="text-rose-400 text-xs font-bold mt-2">Book your next visit</button>
              </div>
            )}
          </div>
        ) : (
          <BookForm onSaved={() => setTab('upcoming')} />
        )}
      </div>
    </div>
  )
}

function BookForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({ 
    visit_type: 'anc', 
    appointment_date: '', 
    appointment_time: '', 
    notes: '' 
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!form.appointment_date || !form.appointment_time) {
      setError('Please select date and time')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.post('/appointments/', form)
      onSaved()
    } catch (e: any) { 
      setError('Error saving. Please try again.')
    } finally { 
      setLoading(false) 
    }
  }

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 animate-in fade-in duration-500">
      <div className="space-y-5">
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block pl-1">Reason for visit</label>
          <select 
            className="input-field appearance-none bg-gray-50" 
            value={form.visit_type} 
            onChange={e => setForm(p => ({ ...p, visit_type: e.target.value }))}
          >
            <option value="anc">ANC Routine Check-up</option>
            <option value="ultrasound">Ultrasound Scan</option>
            <option value="blood_test">Blood Test</option>
            <option value="consultation">Doctor Consultation</option>
            <option value="other">Other</option>
          </select>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block pl-1">Date</label>
            <input 
              className="input-field bg-gray-50" 
              type="date" 
              value={form.appointment_date} 
              onChange={e => setForm(p => ({ ...p, appointment_date: e.target.value }))} 
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block pl-1">Time</label>
            <input 
              className="input-field bg-gray-50" 
              type="time" 
              value={form.appointment_time} 
              onChange={e => setForm(p => ({ ...p, appointment_time: e.target.value }))} 
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block pl-1">Special Notes</label>
          <textarea 
            className="input-field bg-gray-50 min-h-[100px] resize-none" 
            placeholder="Any concerns for the doctor?"
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
          {loading ? <Loader2 className="animate-spin" size={20} /> : 'Confirm Appointment'}
        </button>
      </div>
    </div>
  )
}
