import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Phone, CheckCircle2, Loader2, Navigation } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import api from '../../api/client'

// Fix for default marker icons in Leaflet + React
import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface Hospital {
  id: number;
  name: string;
  type: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  services: string;
}

// Helper to center map
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center, map.getZoom());
  return null;
}

export default function HospitalMap() {
  const nav = useNavigate()
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [loading, setLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<[number, number]>([-6.7924, 39.2083]) // Default Dar es Salaam
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null)
  const [saving, setSaving] = useState(false)
  const [locationNotice, setLocationNotice] = useState('')
  const [error, setError] = useState('')

  const fetchHospitals = useCallback(async () => {
    try {
      setError('')
      const res = await api.get('/hospitals/')
      setHospitals(res.data)
    } catch (e) {
      console.error("Error fetching hospitals", e)
      setError('Could not load hospitals. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const setupTimer = window.setTimeout(() => {
      if (!navigator.geolocation) {
        setLocationNotice('Location is not available on this device. Showing hospitals near Dar es Salaam.')
      } else {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserLocation([pos.coords.latitude, pos.coords.longitude])
            setLocationNotice('')
          },
          () => setLocationNotice('Location permission was denied. Showing hospitals near Dar es Salaam.')
        )
      }

      fetchHospitals()
    }, 0)

    return () => window.clearTimeout(setupTimer)
  }, [fetchHospitals])

  const handleSelect = async (hospital: Hospital) => {
    setSaving(true)
    try {
      setError('')
      await api.patch('/patients/profile/', { hospital: hospital.id })
      setSelectedHospital(hospital)
      setTimeout(() => nav('/profile'), 1500)
    } catch (e) {
      console.error("Failed to save hospital selection", e)
      setError('Failed to save hospital selection. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-rose-400" /></div>

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="p-5 flex items-center gap-4 border-b border-gray-100">
        <button onClick={() => nav(-1)} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-bold text-lg leading-tight">Choose Hospital</h1>
          <p className="text-xs text-gray-500">Find the nearest maternity care</p>
        </div>
      </header>

      {/* Map View */}
      <div className="flex-1 relative z-0">
        {(locationNotice || error) && (
          <div className="absolute top-4 left-4 right-4 z-[1000] space-y-2">
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-white px-4 py-3 text-xs font-semibold text-rose-600 shadow-sm">
                {error}
              </div>
            )}
            {locationNotice && (
              <div className="rounded-2xl border border-amber-200 bg-white px-4 py-3 text-xs font-semibold text-amber-700 shadow-sm">
                {locationNotice}
              </div>
            )}
          </div>
        )}
        <MapContainer center={userLocation} zoom={13} style={{ height: '100%', width: '100%' }}>
          <ChangeView center={userLocation} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {hospitals.map(h => (
            <Marker 
              key={h.id} 
              position={[h.latitude, h.longitude]}
              eventHandlers={{
                click: () => setSelectedHospital(h),
              }}
            >
              <Popup>
                <div className="p-1">
                  <p className="font-bold text-sm m-0">{h.name}</p>
                  <p className="text-xs text-gray-500 m-0">{h.type}</p>
                </div>
              </Popup>
            </Marker>
          ))}
          
          {/* User Location Marker */}
          <Marker position={userLocation} icon={L.divIcon({ className: 'bg-blue-500 w-3 h-3 rounded-full border-2 border-white shadow-lg' })} />
        </MapContainer>
      </div>

      {/* Selection Card */}
      <div className={`absolute bottom-0 left-0 right-0 p-5 bg-white rounded-t-[40px] shadow-[0_-10px_30px_rgba(0,0,0,0.1)] z-10 transition-transform duration-500 ${selectedHospital ? 'translate-y-0' : 'translate-y-2'}`}>
        {selectedHospital ? (
          <div className="animate-in slide-in-from-bottom-5">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">{selectedHospital.type} Facility</span>
                <h2 className="text-xl font-bold text-gray-800">{selectedHospital.name}</h2>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <MapPin size={12} /> {selectedHospital.address}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center">
                <Navigation size={24} className="text-rose-400" />
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 mb-5 space-y-2">
              <p className="text-xs font-semibold text-gray-600">Special Services:</p>
              <p className="text-[11px] text-gray-500 leading-relaxed">{selectedHospital.services}</p>
              <div className="flex items-center gap-2 text-blue-500 pt-1">
                <Phone size={14} />
                <span className="text-xs font-bold">{selectedHospital.phone}</span>
              </div>
            </div>

            <button 
              onClick={() => handleSelect(selectedHospital)}
              disabled={saving}
              className="btn-primary w-full flex items-center justify-center gap-2 h-14"
            >
              {saving ? <CheckCircle2 className="animate-bounce" /> : 'Confirm this hospital'}
            </button>
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Select a marker on the map</p>
            <p className="text-xs text-gray-400 mt-1">to view facility details and contact info</p>
          </div>
        )}
      </div>
    </div>
  )
}
