import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Send, Loader2 } from 'lucide-react'
import api from '../../api/client'
import './provider.css'

interface QueueRow {
  id: number
  mother_name: string
  type: string
  escalated_at: string | null
  updated_at: string
}

interface Msg {
  id: number
  sender_type: 'chatbot' | 'mother' | 'provider'
  sender_name: string
  content: string
  triggered_escalation: boolean
  created_at: string
}

interface RoomRow {
  id: number
  patient: number
  patient_name: string
  last_message: { text: string; sender_id: number; created_at: string } | null
  unread_count: number
}

interface AssignedPatient {
  id: number
  full_name: string
}

interface DirectMessage {
  id: number
  sender: number
  sender_name: string
  text: string
  is_own: boolean
  created_at: string
}

type Tab = 'escalated' | 'direct'

export default function ProviderChatQueue() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const queryId = sp.get('id')
  const queryRoom = sp.get('room')

  const [tab, setTab] = useState<Tab>(queryRoom ? 'direct' : 'escalated')

  // ── Escalated (AI-assisted) queue — unchanged behaviour ──
  const [queue, setQueue] = useState<QueueRow[]>([])
  const [active, setActive] = useState<number | null>(queryId ? parseInt(queryId) : null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingQ, setLoadingQ] = useState(true)
  const pollRef = useRef<number | null>(null)

  // ── Direct messages (chat app) ──
  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [patients, setPatients] = useState<AssignedPatient[]>([])
  const [loadingPatients, setLoadingPatients] = useState(true)
  const [startingChatFor, setStartingChatFor] = useState<number | null>(null)
  const [activeRoom, setActiveRoom] = useState<number | null>(queryRoom ? parseInt(queryRoom) : null)
  const [roomMessages, setRoomMessages] = useState<DirectMessage[]>([])
  const [roomText, setRoomText] = useState('')
  const [roomSending, setRoomSending] = useState(false)
  const roomPollRef = useRef<number | null>(null)

  const loadQueue = async () => {
    try {
      const r = await api.get('/chatbot/provider/queue/')
      setQueue(r.data)
    } finally {
      setLoadingQ(false)
    }
  }

  const loadMessages = async (cid: number) => {
    try {
      const r = await api.get(`/chatbot/conversation/${cid}/messages/`)
      setMessages(r.data.messages || [])
    } catch {
      setMessages([])
    }
  }

  useEffect(() => { void loadQueue() }, [])

  useEffect(() => {
    if (active == null) return
    void loadMessages(active)
    pollRef.current = window.setInterval(() => void loadMessages(active), 4000)
    return () => { if (pollRef.current) window.clearInterval(pollRef.current) }
  }, [active])

  const send = async () => {
    if (!active || !text.trim() || sending) return
    setSending(true)
    try {
      await api.post('/chatbot/provider/reply/', { conversation_id: active, content: text })
      setText('')
      await loadMessages(active)
    } finally {
      setSending(false)
    }
  }

  // ── Direct messages logic ──
  const loadRooms = async () => {
    try {
      const r = await api.get<RoomRow[]>('/chat/rooms/')
      setRooms(r.data)
    } finally {
      setLoadingRooms(false)
    }
  }

  const loadRoomMessages = async (roomId: number) => {
    try {
      const r = await api.get(`/chat/rooms/${roomId}/messages/`)
      setRoomMessages(r.data.results || [])
    } catch {
      setRoomMessages([])
    }
  }

  const loadPatients = async () => {
    try {
      const r = await api.get<AssignedPatient[]>('/patients/')
      setPatients(r.data)
    } finally {
      setLoadingPatients(false)
    }
  }

  useEffect(() => {
    if (tab === 'direct') {
      void loadRooms()
      void loadPatients()
    }
  }, [tab])

  // Assigned patients with no existing room yet — the provider can message
  // any of them without waiting for the patient to reach out first.
  const patientsWithoutRoom = patients.filter(p => !rooms.some(r => r.patient === p.id))

  const startChat = async (patientId: number) => {
    setStartingChatFor(patientId)
    try {
      const r = await api.post<RoomRow>('/chat/rooms/', { patient_id: patientId })
      setRooms(prev => [r.data, ...prev.filter(x => x.id !== r.data.id)])
      setActiveRoom(r.data.id)
    } catch (e) {
      console.error(e)
    } finally {
      setStartingChatFor(null)
    }
  }

  useEffect(() => {
    if (activeRoom == null) return
    void api.post(`/chat/rooms/${activeRoom}/mark-read/`).catch(() => {})
    void loadRoomMessages(activeRoom)
    roomPollRef.current = window.setInterval(() => void loadRoomMessages(activeRoom), 4000)
    return () => { if (roomPollRef.current) window.clearInterval(roomPollRef.current) }
  }, [activeRoom])

  const sendRoom = async () => {
    if (!activeRoom || !roomText.trim() || roomSending) return
    setRoomSending(true)
    try {
      await api.post(`/chat/rooms/${activeRoom}/messages/`, { text: roomText })
      setRoomText('')
      await loadRoomMessages(activeRoom)
    } finally {
      setRoomSending(false)
    }
  }

  const activeRoomInfo = rooms.find(r => r.id === activeRoom)

  // ── Escalated conversation thread ──
  if (tab === 'escalated' && active) {
    return (
      <div className="provider-page" style={{ paddingBottom: 80 }}>
        <header className="provider-header">
          <button onClick={() => setActive(null)} className="provider-logout"><ArrowLeft size={16} /></button>
          <div className="flex-1 text-center">
            <p className="provider-eyebrow">Live chat</p>
            <h1 className="provider-name" style={{ fontSize: 16 }}>Conversation #{active}</h1>
          </div>
          <div style={{ width: 36 }} />
        </header>

        <section className="provider-section" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {messages.length === 0 && <p className="provider-empty">No messages yet.</p>}
          {messages.map(m => (
            <div key={m.id} style={{
              display: 'flex',
              justifyContent: m.sender_type === 'mother' ? 'flex-start' : 'flex-end',
              marginBottom: 6,
            }}>
              <div style={{
                maxWidth: '78%',
                padding: '8px 12px',
                borderRadius: 14,
                fontSize: 13,
                background: m.sender_type === 'chatbot' ? '#fef3c7' :
                           m.sender_type === 'provider' ? '#dbeafe' : '#fce7f3',
                color: '#111827',
              }}>
                <p style={{ fontSize: 9, fontWeight: 700, marginBottom: 2, opacity: 0.7 }}>
                  {m.sender_type === 'chatbot' ? 'HEALTH ASSISTANT' : m.sender_name.toUpperCase()}
                  {m.triggered_escalation && ' • ESCALATED'}
                </p>
                {m.content}
              </div>
            </div>
          ))}
        </section>

        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          maxWidth: 480, width: '100%', padding: 12, background: '#fff', borderTop: '1px solid #f3f4f6',
          display: 'flex', gap: 8,
        }}>
          <input
            className="field-input"
            placeholder="Reply to mother..."
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void send() }}
            style={{ flex: 1 }}
          />
          <button onClick={() => void send()} disabled={sending || !text.trim()} className="anc-fab"
            style={{ position: 'static', transform: 'none', padding: '10px 16px', maxWidth: 'none' }}>
            {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
          </button>
        </div>
      </div>
    )
  }

  // ── Direct message thread ──
  if (tab === 'direct' && activeRoom) {
    return (
      <div className="provider-page" style={{ paddingBottom: 80 }}>
        <header className="provider-header">
          <button onClick={() => { setActiveRoom(null); void loadRooms() }} className="provider-logout"><ArrowLeft size={16} /></button>
          <div className="flex-1 text-center">
            <p className="provider-eyebrow">Direct message</p>
            <h1 className="provider-name" style={{ fontSize: 16 }}>{activeRoomInfo?.patient_name || 'Mother'}</h1>
          </div>
          <div style={{ width: 36 }} />
        </header>

        <section className="provider-section" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {roomMessages.length === 0 && <p className="provider-empty">No messages yet.</p>}
          {roomMessages.map(m => (
            <div key={m.id} style={{
              display: 'flex',
              justifyContent: m.is_own ? 'flex-end' : 'flex-start',
              marginBottom: 6,
            }}>
              <div style={{
                maxWidth: '78%',
                padding: '8px 12px',
                borderRadius: 14,
                fontSize: 13,
                background: m.is_own ? '#dbeafe' : '#fce7f3',
                color: '#111827',
              }}>
                <p style={{ fontSize: 9, fontWeight: 700, marginBottom: 2, opacity: 0.7 }}>
                  {m.is_own ? 'YOU' : m.sender_name.toUpperCase()}
                </p>
                {m.text}
              </div>
            </div>
          ))}
        </section>

        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          maxWidth: 480, width: '100%', padding: 12, background: '#fff', borderTop: '1px solid #f3f4f6',
          display: 'flex', gap: 8,
        }}>
          <input
            className="field-input"
            placeholder="Message this mother..."
            value={roomText}
            onChange={e => setRoomText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void sendRoom() }}
            style={{ flex: 1 }}
          />
          <button onClick={() => void sendRoom()} disabled={roomSending || !roomText.trim()} className="anc-fab"
            style={{ position: 'static', transform: 'none', padding: '10px 16px', maxWidth: 'none' }}>
            {roomSending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
          </button>
        </div>
      </div>
    )
  }

  // ── List view (either tab) ──
  return (
    <div className="provider-page">
      <header className="provider-header">
        <button onClick={() => nav('/provider/dashboard')} className="provider-logout"><ArrowLeft size={16} /></button>
        <div className="flex-1 text-center">
          <p className="provider-eyebrow">Messages</p>
          <h1 className="provider-name" style={{ fontSize: 18 }}>
            {tab === 'escalated' ? 'Escalated conversations' : 'Direct messages'}
          </h1>
        </div>
        <div style={{ width: 36 }} />
      </header>

      <div style={{ display: 'flex', gap: 6, padding: '10px 16px 0' }}>
        <button
          type="button"
          onClick={() => setTab('escalated')}
          style={{
            flex: 1, padding: '8px 10px', borderRadius: '10px 10px 0 0', border: 'none',
            background: tab === 'escalated' ? 'var(--pv-card)' : 'transparent',
            color: tab === 'escalated' ? '#D4537E' : 'var(--pv-text-muted)',
            fontWeight: 700, fontSize: 12, cursor: 'pointer',
          }}
        >
          Escalated {queue.length > 0 && `(${queue.length})`}
        </button>
        <button
          type="button"
          onClick={() => setTab('direct')}
          style={{
            flex: 1, padding: '8px 10px', borderRadius: '10px 10px 0 0', border: 'none',
            background: tab === 'direct' ? 'var(--pv-card)' : 'transparent',
            color: tab === 'direct' ? '#D4537E' : 'var(--pv-text-muted)',
            fontWeight: 700, fontSize: 12, cursor: 'pointer',
          }}
        >
          Direct {rooms.some(r => r.unread_count > 0) && `(${rooms.reduce((s, r) => s + r.unread_count, 0)})`}
        </button>
      </div>

      <section className="provider-section">
        {tab === 'escalated' ? (
          loadingQ ? (
            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-rose-400" /></div>
          ) : queue.length === 0 ? (
            <p className="provider-empty">No live chats — the chatbot is handling everything.</p>
          ) : queue.map(q => (
            <button key={q.id} className="chat-row" onClick={() => setActive(q.id)}>
              <div>
                <p className="alert-patient">{q.mother_name}</p>
                <p className="alert-meta">Escalated {q.escalated_at ? new Date(q.escalated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</p>
              </div>
              <span className="badge-red">Live</span>
            </button>
          ))
        ) : (
          loadingRooms || loadingPatients ? (
            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-rose-400" /></div>
          ) : rooms.length === 0 && patientsWithoutRoom.length === 0 ? (
            <p className="provider-empty">You have no assigned patients yet.</p>
          ) : (
            <>
              {rooms.map(r => (
                <button key={r.id} className="chat-row" onClick={() => setActiveRoom(r.id)}>
                  <div className="chat-row-body">
                    <p className="alert-patient">{r.patient_name}</p>
                    <p className="alert-meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.last_message?.text || 'No messages yet'}
                    </p>
                  </div>
                  {r.unread_count > 0 && <span className="badge-red">{r.unread_count}</span>}
                </button>
              ))}
              {patientsWithoutRoom.map(p => (
                <div key={p.id} className="chat-row">
                  <div className="chat-row-body">
                    <p className="alert-patient">{p.full_name}</p>
                    <p className="alert-meta">No conversation yet</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void startChat(p.id)}
                    disabled={startingChatFor === p.id}
                    style={{
                      background: '#D4537E', color: '#fff', border: 'none', padding: '6px 12px',
                      borderRadius: 8, fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    {startingChatFor === p.id ? <Loader2 className="animate-spin" size={12} /> : 'Message'}
                  </button>
                </div>
              ))}
            </>
          )
        )}
      </section>
    </div>
  )
}
