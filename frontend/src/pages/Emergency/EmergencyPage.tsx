import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, Building2, Heart, MapPin, Loader2, AlertTriangle, ShieldCheck, Info } from 'lucide-react'
import api from '../../api/client'
import { useTranslation } from 'react-i18next'

interface Contact {
  id: number;
  name: string;
  phone_number: string;
  relationship: string;
}

interface HospitalData {
  assigned_hospital: {
    name: string;
    phone: string;
    address: string;
  } | null;
}

interface Instruction {
  title: string;
  text: string;
  title_sw: string;
  text_sw: string;
}

export default function EmergencyPage() {
  const nav = useNavigate()
  const { i18n } = useTranslation()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [hospital, setHospital] = useState<HospitalData | null>(null)
  const [instructions, setInstructions] = useState<Instruction[]>([])
  const [loading, setLoading] = useState(true)
  const [sosTriggered, setSosTriggered] = useState(false)
  const [sharingLocation, setSharingLocation] = useState(false)

  const isSwahili = i18n.language === 'sw'

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [contactsRes, hospitalRes] = await Promise.all([
          api.get('/emergency/contacts/'),
          api.get('/emergency/hospitals/')
        ])
        setContacts(contactsRes.data)
        setHospital(hospitalRes.data)
      } catch (error) {
        console.error('Error fetching emergency data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleSOS = () => {
    setSosTriggered(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const res = await api.post('/emergency/trigger-sos/', { 
            latitude: pos.coords.latitude, 
            longitude: pos.coords.longitude 
          })
          setInstructions(res.data.instructions)
        } catch (e) { console.error(e) }
      },
      async () => {
        try {
          const res = await api.post('/emergency/trigger-sos/')
          setInstructions(res.data.instructions)
        } catch (e) { console.error(e) }
      }
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
      </div>
    )
  }

  if (sosTriggered) {
    return (
      <div className="min-h-screen pb-24 bg-white flex justify-center overflow-y-auto">
        <div className="w-full max-w-lg p-5">
           <div className="bg-red-50 border-2 border-red-200 p-6 rounded-[40px] text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center mx-auto mb-4 text-white">
                 <Phone size={32} />
              </div>
              <h2 className="text-2xl font-black text-red-600 mb-2">SOS ALERT SENT</h2>
              <p className="text-sm font-bold text-red-500 leading-relaxed">
                Your location has been sent to your healthcare provider. 
                They are being notified now via SMS.
              </p>
           </div>

           <h3 className="font-black text-lg text-gray-800 mb-4 flex items-center gap-2">
             <Info size={24} className="text-rose-400" />
             Immediate Instructions
           </h3>

           <div className="space-y-4">
              {instructions.length > 0 ? instructions.map((ins, idx) => (
                <div key={idx} className="bg-rose-50 p-5 rounded-3xl border border-rose-100 animate-in slide-in-from-bottom-2">
                   <p className="font-bold text-rose-600 mb-1">{isSwahili ? ins.title_sw : ins.title}</p>
                   <p className="text-xs text-rose-500 leading-relaxed font-medium">{isSwahili ? ins.text_sw : ins.text}</p>
                </div>
              )) : (
                <div className="space-y-4">
                  <div className="bg-rose-50 p-5 rounded-3xl border border-rose-100">
                    <p className="font-bold text-rose-600 mb-1">Stay Calm</p>
                    <p className="text-xs text-rose-500 leading-relaxed font-medium">Sit or lie down in a safe, quiet place. Breathe deeply.</p>
                  </div>
                  <div className="bg-rose-50 p-5 rounded-3xl border border-rose-100">
                    <p className="font-bold text-rose-600 mb-1">Do not eat or drink</p>
                    <p className="text-xs text-rose-500 leading-relaxed font-medium">In case surgery is needed, please avoid consuming any food or water.</p>
                  </div>
                </div>
              )}
           </div>

           <button 
             onClick={() => setSosTriggered(false)}
             className="w-full mt-10 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-50 rounded-2xl"
           >
             Cancel Alert
           </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24 bg-[#faf9f7] flex justify-center">
      <div className="w-full max-w-lg p-5">
        <header className="flex items-center justify-between mb-8">
          <button onClick={() => nav('/home')} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">Emergency Center</h1>
          <div className="w-10" />
        </header>

        <div className="bg-amber-50 border border-amber-100 p-4 rounded-3xl mb-8 flex gap-3">
          <AlertTriangle className="text-amber-500 shrink-0" size={20} />
          <p className="text-[11px] text-amber-800 font-semibold leading-relaxed">
            In case of heavy bleeding, severe headache, or sudden swelling, 
            contact emergency services immediately.
          </p>
        </div>

        {/* Big SOS Button */}
        <button 
          onClick={handleSOS}
          className="w-full py-8 rounded-[40px] flex flex-col items-center justify-center gap-4 mb-8 active:scale-95 transition-all shadow-xl"
          style={{background:'linear-gradient(135deg,#f43f5e,#e11d48)'}}
        >
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
            <Phone size={40} color="white" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <p className="text-white text-2xl font-black tracking-tighter uppercase">PRESS FOR HELP</p>
            <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mt-1">EMERGENCY SOS</p>
          </div>
        </button>

        <div className="space-y-6">
          {/* Hospital Section */}
          <section>
            <h3 className="font-bold text-sm text-gray-400 uppercase tracking-widest mb-3 pl-1">Medical Care</h3>
            {hospital?.assigned_hospital ? (
              <button 
                onClick={() => window.location.href = `tel:${hospital.assigned_hospital!.phone}`}
                className="bg-white w-full p-5 rounded-3xl flex items-center gap-4 shadow-sm border border-gray-100 active:bg-gray-50 transition-colors"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <Building2 size={24} className="text-blue-500" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-bold text-sm truncate">{hospital.assigned_hospital.name}</p>
                  <p className="text-[11px] text-gray-500">{hospital.assigned_hospital.phone}</p>
                </div>
                <Phone size={18} className="text-gray-300" />
              </button>
            ) : (
              <p className="text-xs text-gray-400 italic pl-1">No hospital assigned yet.</p>
            )}
          </section>

          {/* Contacts Section */}
          <section>
            <h3 className="font-bold text-sm text-gray-400 uppercase tracking-widest mb-3 pl-1">Emergency Contacts</h3>
            {contacts.length > 0 ? (
              <div className="space-y-3">
                {contacts.map(contact => (
                  <button 
                    key={contact.id}
                    onClick={() => window.location.href = `tel:${contact.phone_number}`}
                    className="bg-white w-full p-5 rounded-3xl flex items-center gap-4 shadow-sm border border-gray-100 active:bg-gray-50 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center">
                      <Heart size={24} className="text-rose-500" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-bold text-sm">{contact.name}</p>
                      <p className="text-[11px] text-gray-500 uppercase font-semibold tracking-wider">{contact.relationship}</p>
                    </div>
                    <Phone size={18} className="text-gray-300" />
                  </button>
                ))}
              </div>
            ) : (
              <button 
                onClick={() => nav('/profile')}
                className="w-full p-5 rounded-3xl border-2 border-dashed border-gray-200 text-gray-400 flex flex-col items-center gap-2"
              >
                <span className="text-xs font-bold">No contacts added</span>
                <span className="text-[10px]">Tap to add emergency contacts in Profile</span>
              </button>
            )}
          </section>

          {/* Quick Share Section */}
          <section>
            <h3 className="font-bold text-sm text-gray-400 uppercase tracking-widest mb-3 pl-1">Quick Tools</h3>
            <button 
              onClick={() => setSharingLocation(true)}
              disabled={sharingLocation}
              className={`w-full p-5 rounded-3xl flex items-center gap-4 shadow-sm border border-gray-100 transition-all ${sharingLocation ? 'bg-green-50' : 'bg-white active:bg-gray-50'}`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${sharingLocation ? 'bg-white' : 'bg-gray-50'}`}>
                {sharingLocation ? <ShieldCheck size={24} className="text-green-500" /> : <MapPin size={24} className="text-gray-400" />}
              </div>
              <div className="text-left flex-1">
                <p className="font-bold text-sm">{sharingLocation ? 'Location Sent!' : 'Share Live Location'}</p>
                <p className="text-[11px] text-gray-500">{sharingLocation ? 'Help is being notified of your position.' : 'Send coordinates to your contacts.'}</p>
              </div>
              {sharingLocation && <Loader2 size={18} className="text-green-500 animate-spin" />}
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
