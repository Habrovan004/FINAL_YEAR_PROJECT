import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Phone, Building2, Heart, MapPin, Loader2,
  AlertTriangle, ShieldCheck, Info, X, WifiOff, Share2, CheckCircle2,
  Siren, Stethoscope, ChevronRight,
} from 'lucide-react'
import PageWrapper from '../../components/layout/PageWrapper'
import api from '../../api/client'
import './EmergencyPage.css'

// ── Types ──────────────────────────────────────────────────────────────────
interface Contact {
  id: number
  name: string
  phone_number: string
  relationship: string
}

interface HospitalData {
  assigned_hospital: {
    name: string
    phone: string
    address: string
  } | null
}

interface Instruction {
  title: string
  text: string
  title_sw: string
  text_sw: string
}

interface Coords {
  latitude: number
  longitude: number
  accuracy?: number
  capturedAt: number
}

interface QueuedAlert {
  latitude: number | null
  longitude: number | null
  queuedAt: number
}

// ── Constants ──────────────────────────────────────────────────────────────
const LONG_PRESS_MS = 1500
const QUEUE_KEY = 'pending_sos_alert'
const TZ_EMERGENCY = '112'   // Tanzania universal emergency number
const TZ_AMBULANCE = '112'

// ── Helpers ────────────────────────────────────────────────────────────────
const triggerHaptic = (pattern: number | number[] = 60) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern) } catch { /* unsupported */ }
  }
}

const formatCoords = (c: Coords | null) => {
  if (!c) return ''
  return `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`
}

const mapsLink = (c: Coords) =>
  `https://www.google.com/maps?q=${c.latitude},${c.longitude}`

// ── Page ───────────────────────────────────────────────────────────────────
export default function EmergencyPage() {
  const nav = useNavigate()
  const { i18n, t } = useTranslation()
  const isSwahili = i18n.language?.startsWith('sw')

  const [contacts, setContacts] = useState<Contact[]>([])
  const [hospital, setHospital] = useState<HospitalData | null>(null)
  const [instructions, setInstructions] = useState<Instruction[]>([])
  const [loading, setLoading] = useState(true)

  const [coords, setCoords] = useState<Coords | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'>('idle')

  const [pressProgress, setPressProgress] = useState(0)
  const [pressing, setPressing] = useState(false)
  const [sending, setSending] = useState(false)
  const [sosTriggered, setSosTriggered] = useState(false)
  const [providerName, setProviderName] = useState('')
  const [error, setError] = useState('')
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [queued, setQueued] = useState(false)

  const pressTimerRef = useRef<number | null>(null)
  const pressFrameRef = useRef<number | null>(null)
  const pressStartRef = useRef<number>(0)
  const liveRegionRef = useRef<HTMLDivElement | null>(null)

  // ── Data fetch ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [c, h] = await Promise.all([
          api.get('/emergency/contacts/'),
          api.get('/emergency/hospitals/'),
        ])
        if (cancelled) return
        setContacts(c.data || [])
        setHospital(h.data || null)
      } catch (e) {
        console.error('Emergency data load failed:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  // ── Online / offline tracking ───────────────────────────────────────────
  useEffect(() => {
    const goOnline = () => { setOnline(true); void flushQueued() }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // ── Pre-warm GPS (non-blocking) so coords are ready when SOS fires ─────
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsStatus('unavailable')
      return
    }
    setGpsStatus('requesting')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          capturedAt: Date.now(),
        })
        setGpsStatus('granted')
      },
      err => {
        console.warn('GPS denied/failed:', err)
        setGpsStatus('denied')
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30_000 },
    )
  }, [])

  // ── Try to flush any queued alert on mount + when going online ─────────
  useEffect(() => { void flushQueued() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const flushQueued = useCallback(async () => {
    try {
      const raw = localStorage.getItem(QUEUE_KEY)
      if (!raw) return
      if (!navigator.onLine) return
      const payload: QueuedAlert = JSON.parse(raw)
      await api.post('/emergency/trigger-sos/', {
        latitude: payload.latitude,
        longitude: payload.longitude,
      })
      localStorage.removeItem(QUEUE_KEY)
      setQueued(false)
    } catch (e) {
      console.warn('Queue flush failed; will retry later:', e)
    }
  }, [])

  // ── Core: send the SOS alert (and start a call) ─────────────────────────
  const fireSOS = useCallback(async () => {
    setSending(true)
    setError('')
    triggerHaptic([100, 50, 100])

    // Use whatever GPS we have. Try one more time for a fresh fix if we have none.
    let snapshot = coords
    if (!snapshot && 'geolocation' in navigator) {
      try {
        snapshot = await new Promise<Coords>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            p => resolve({
              latitude: p.coords.latitude,
              longitude: p.coords.longitude,
              accuracy: p.coords.accuracy,
              capturedAt: Date.now(),
            }),
            reject,
            { enableHighAccuracy: true, timeout: 4000, maximumAge: 30_000 },
          )
        })
        setCoords(snapshot)
      } catch { /* proceed without */ }
    }

    // Open the dialer immediately — works even fully offline on a real phone.
    try { window.location.href = `tel:${TZ_EMERGENCY}` } catch { /* desktop */ }

    // Speak to the screen reader
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = t('sr_sos_dispatched')
    }

    const payload = {
      latitude: snapshot?.latitude ?? null,
      longitude: snapshot?.longitude ?? null,
    }

    if (!online) {
      try {
        localStorage.setItem(QUEUE_KEY, JSON.stringify({ ...payload, queuedAt: Date.now() } as QueuedAlert))
        setQueued(true)
      } catch { /* ignore quota */ }
      setSosTriggered(true)
      setSending(false)
      return
    }

    try {
      const res = await api.post('/emergency/trigger-sos/', payload)
      setProviderName(res.data?.provider_name || t('emergency_center_default'))
      setInstructions(res.data?.instructions || [])
      setSosTriggered(true)
    } catch (e) {
      console.error('SOS POST failed:', e)
      try {
        localStorage.setItem(QUEUE_KEY, JSON.stringify({ ...payload, queuedAt: Date.now() } as QueuedAlert))
        setQueued(true)
      } catch { /* ignore */ }
      setError(t('sos_post_failed'))
      // Still show the post-trigger screen — the call already went out.
      setSosTriggered(true)
    } finally {
      setSending(false)
    }
  }, [coords, online, t])

  // ── Long-press handlers ─────────────────────────────────────────────────
  const cancelPress = useCallback(() => {
    if (pressTimerRef.current) {
      window.clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    if (pressFrameRef.current) {
      cancelAnimationFrame(pressFrameRef.current)
      pressFrameRef.current = null
    }
    setPressing(false)
    setPressProgress(0)
  }, [])

  const startPress = useCallback(() => {
    if (sending || sosTriggered) return
    setPressing(true)
    pressStartRef.current = Date.now()
    triggerHaptic(20)
    const tick = () => {
      const elapsed = Date.now() - pressStartRef.current
      setPressProgress(Math.min(1, elapsed / LONG_PRESS_MS))
      if (elapsed < LONG_PRESS_MS) {
        pressFrameRef.current = requestAnimationFrame(tick)
      }
    }
    pressFrameRef.current = requestAnimationFrame(tick)
    pressTimerRef.current = window.setTimeout(() => {
      cancelPress()
      void fireSOS()
    }, LONG_PRESS_MS)
  }, [sending, sosTriggered, cancelPress, fireSOS])

  // Cleanup on unmount
  useEffect(() => () => cancelPress(), [cancelPress])

  // ── Quick contacts (police, ambulance, hospital, family) ────────────────
  const quickContacts = useMemo(() => {
    const list: { key: string; label: string; sublabel: string; tel: string; icon: typeof Phone; tone: 'red' | 'blue' | 'pink' }[] = [
      {
        key: 'police',
        label: t('police'),
        sublabel: TZ_EMERGENCY,
        tel: TZ_EMERGENCY,
        icon: Siren,
        tone: 'red',
      },
      {
        key: 'ambulance',
        label: t('ambulance'),
        sublabel: TZ_AMBULANCE,
        tel: TZ_AMBULANCE,
        icon: Stethoscope,
        tone: 'red',
      },
    ]
    if (hospital?.assigned_hospital?.phone) {
      list.push({
        key: 'hospital',
        label: hospital.assigned_hospital.name,
        sublabel: hospital.assigned_hospital.phone,
        tel: hospital.assigned_hospital.phone,
        icon: Building2,
        tone: 'blue',
      })
    }
    return list
  }, [hospital, t])

  // ── Share location via native share or SMS fallback ─────────────────────
  const shareLocation = useCallback(async () => {
    if (!coords) {
      setError(t('share_no_gps'))
      return
    }
    const link = mapsLink(coords)
    const message = `${t('share_message_prefix')}: ${link}`
    if (navigator.share) {
      try {
        await navigator.share({ title: t('share_title'), text: message, url: link })
        return
      } catch { /* user cancelled */ }
    }
    // SMS fallback: open the SMS app pre-filled
    window.location.href = `sms:?body=${encodeURIComponent(message)}`
  }, [coords, t])

  // ── Loader ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <PageWrapper>
        <div className="emg-loader" role="status">
          <Loader2 className="emg-spin" size={28} />
        </div>
      </PageWrapper>
    )
  }

  // ── Post-trigger acknowledgement screen ─────────────────────────────────
  if (sosTriggered) {
    return (
      <PageWrapper>
        <div className="emg-page">
          <div className="emg-ack-card" role="alert">
            <div className="emg-ack-icon">
              <CheckCircle2 size={36} />
            </div>
            <h2 className="emg-ack-title">{queued ? t('sos_queued_title') : t('sos_sent_title')}</h2>
            <p className="emg-ack-sub">
              {queued
                ? t('sos_queued_sub')
                : providerName
                  ? t('sos_sent_sub_with_provider', { provider: providerName })
                  : t('sos_sent_sub_generic')}
            </p>
            {coords && (
              <a className="emg-ack-link" href={mapsLink(coords)} target="_blank" rel="noreferrer">
                <MapPin size={14} /> {formatCoords(coords)}
              </a>
            )}
            {error && (
              <p className="emg-ack-error">{error}</p>
            )}
          </div>

          <div className="emg-quick-row">
            <a className="emg-quick-cta primary" href={`tel:${TZ_EMERGENCY}`}>
              <Phone size={18} /> {t('call_emergency', { number: TZ_EMERGENCY })}
            </a>
            <button className="emg-quick-cta ghost" onClick={shareLocation}>
              <Share2 size={18} /> {t('share_location')}
            </button>
          </div>

          <h3 className="emg-section-label"><Info size={14} /> {t('immediate_instructions')}</h3>
          <div className="emg-instr-list">
            {(instructions.length > 0 ? instructions : DEFAULT_INSTRUCTIONS).map((ins, i) => (
              <div key={i} className="emg-instr-card">
                <p className="emg-instr-title">{isSwahili ? ins.title_sw : ins.title}</p>
                <p className="emg-instr-text">{isSwahili ? ins.text_sw : ins.text}</p>
              </div>
            ))}
          </div>

          <button
            className="emg-cancel-btn"
            onClick={() => { setSosTriggered(false); setQueued(false); setError('') }}
          >
            <X size={14} /> {t('close_alert')}
          </button>
        </div>
      </PageWrapper>
    )
  }

  // ── Main page ───────────────────────────────────────────────────────────
  return (
    <PageWrapper>
      <div className="emg-page">
        {/* Header */}
        <header className="emg-header">
          <button className="emg-back" onClick={() => nav('/home')} aria-label={t('back')}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="emg-title">{t('emergency_center')}</h1>
          <span className="emg-header-spacer" aria-hidden="true" />
        </header>

        {/* Network + GPS status */}
        <div className="emg-status-row" aria-live="polite">
          <span className={`emg-status-chip ${online ? 'ok' : 'warn'}`}>
            {online
              ? <><CheckCircle2 size={12} /> {t('status_online')}</>
              : <><WifiOff size={12} /> {t('status_offline')}</>}
          </span>
          <span className={`emg-status-chip ${gpsStatus === 'granted' ? 'ok' : gpsStatus === 'requesting' ? 'pending' : 'warn'}`}>
            <MapPin size={12} />
            {gpsStatus === 'granted' ? t('status_gps_ok')
              : gpsStatus === 'requesting' ? t('status_gps_finding')
              : gpsStatus === 'denied' ? t('status_gps_denied')
              : gpsStatus === 'unavailable' ? t('status_gps_unavailable')
              : t('status_gps_idle')}
          </span>
        </div>

        {/* Warning banner */}
        <div className="emg-warning" role="note">
          <AlertTriangle size={18} />
          <p>{t('emergency_warning')}</p>
        </div>

        {/* SOS — long press */}
        <div className="emg-sos-wrap">
          <button
            className={`emg-sos-btn ${pressing ? 'pressing' : ''} ${sending ? 'sending' : ''}`}
            onPointerDown={startPress}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onPointerCancel={cancelPress}
            onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') startPress() }}
            onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') cancelPress() }}
            disabled={sending}
            aria-label={t('sos_aria_label')}
            aria-describedby="emg-sos-hint"
          >
            <svg className="emg-sos-ring" viewBox="0 0 120 120" aria-hidden="true">
              <circle className="emg-sos-ring-track" cx="60" cy="60" r="56" />
              <circle
                className="emg-sos-ring-fill"
                cx="60"
                cy="60"
                r="56"
                style={{ strokeDashoffset: 352 * (1 - pressProgress) }}
              />
            </svg>
            <div className="emg-sos-core">
              {sending
                ? <Loader2 className="emg-spin" size={36} />
                : <Phone size={40} strokeWidth={2.5} />}
            </div>
            <div className="emg-sos-text">
              <p className="emg-sos-headline">{sending ? t('sos_dispatching') : t('press_for_help')}</p>
              <p className="emg-sos-sub">{t('sos_long_press_hint')}</p>
            </div>
          </button>
          <p id="emg-sos-hint" className="emg-sos-side-hint">
            {pressing
              ? t('keep_holding')
              : t('long_press_explanation', { seconds: (LONG_PRESS_MS / 1000).toFixed(1) })}
          </p>

          {/* Tap-to-call escape hatch — no confirmation */}
          <a className="emg-tap-call" href={`tel:${TZ_EMERGENCY}`}>
            <Phone size={14} /> {t('call_now_no_confirm', { number: TZ_EMERGENCY })}
          </a>
        </div>

        {/* Quick contacts */}
        <section className="emg-section">
          <h3 className="emg-section-label">{t('quick_dial')}</h3>
          <div className="emg-quick-grid">
            {quickContacts.map(c => {
              const Icon = c.icon
              return (
                <a key={c.key} href={`tel:${c.tel}`} className={`emg-quick-card tone-${c.tone}`}>
                  <div className="emg-quick-icon"><Icon size={20} /></div>
                  <div className="emg-quick-body">
                    <p className="emg-quick-label">{c.label}</p>
                    <p className="emg-quick-sub">{c.sublabel}</p>
                  </div>
                  <Phone size={16} className="emg-quick-arrow" />
                </a>
              )
            })}
          </div>
        </section>

        {/* Family contacts */}
        <section className="emg-section">
          <h3 className="emg-section-label">{t('emergency_contacts')}</h3>
          {contacts.length > 0 ? (
            <div className="emg-contact-list">
              {contacts.map(contact => (
                <a key={contact.id} href={`tel:${contact.phone_number}`} className="emg-contact-card">
                  <div className="emg-contact-icon"><Heart size={18} /></div>
                  <div className="emg-contact-body">
                    <p className="emg-contact-name">{contact.name}</p>
                    <p className="emg-contact-meta">
                      {contact.relationship} · {contact.phone_number}
                    </p>
                  </div>
                  <Phone size={16} className="emg-contact-arrow" />
                </a>
              ))}
            </div>
          ) : (
            <button className="emg-empty-card" onClick={() => nav('/profile')}>
              <Heart size={20} />
              <span className="emg-empty-title">{t('no_contacts_added')}</span>
              <span className="emg-empty-sub">{t('no_contacts_sub')}</span>
              <span className="emg-empty-cta">{t('add_contacts')} <ChevronRight size={14} /></span>
            </button>
          )}
        </section>

        {/* Tools */}
        <section className="emg-section">
          <h3 className="emg-section-label">{t('tools')}</h3>
          <button className="emg-tool-card" onClick={shareLocation} disabled={!coords}>
            <div className="emg-tool-icon"><Share2 size={18} /></div>
            <div className="emg-tool-body">
              <p className="emg-tool-title">
                {coords ? t('share_my_location') : t('share_location_disabled')}
              </p>
              <p className="emg-tool-sub">
                {coords ? formatCoords(coords) : t('share_location_disabled_sub')}
              </p>
            </div>
            <ShieldCheck size={16} className="emg-tool-arrow" />
          </button>
        </section>

        {error && <p className="emg-inline-error" role="alert">{error}</p>}

        {/* Screen-reader live region */}
        <div ref={liveRegionRef} className="sr-only" aria-live="assertive" />
      </div>
    </PageWrapper>
  )
}

// ── Default instructions when API returns none ────────────────────────────
const DEFAULT_INSTRUCTIONS: Instruction[] = [
  {
    title: 'Stay calm',
    text: 'Sit or lie down on your left side in a safe, quiet place. Breathe slowly.',
    title_sw: 'Tulia',
    text_sw: 'Kaa au lala upande wa kushoto mahali salama. Pumua taratibu.',
  },
  {
    title: 'Do not eat or drink',
    text: 'In case surgery is needed, avoid any food or water until you have been seen.',
    title_sw: 'Usile wala kunywa',
    text_sw: 'Iwapo upasuaji utahitajika, epuka chakula na maji hadi utakapoonana na daktari.',
  },
  {
    title: 'Have someone with you',
    text: 'Ask a family member, neighbour or partner to stay with you until help arrives.',
    title_sw: 'Mtu akae nawe',
    text_sw: 'Mwambie mwanafamilia, jirani au mwenzi akae nawe hadi msaada utakapofika.',
  },
]
