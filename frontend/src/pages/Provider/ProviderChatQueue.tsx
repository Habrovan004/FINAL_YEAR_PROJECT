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

export default function ProviderChatQueue() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const queryId = sp.get('id')

  const [queue, setQueue] = useState<QueueRow[]>([])
  const [active, setActive] = useState<number | null>(queryId ? parseInt(queryId) : null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingQ, setLoadingQ] = useState(true)
  const pollRef = useRef<number | null>(null)

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

  if (!active) {
    return (
      <div className="provider-page">
        <header className="provider-header">
          <button onClick={() => nav('/provider/dashboard')} className="provider-logout"><ArrowLeft size={16} /></button>
          <div className="flex-1 text-center">
            <p className="provider-eyebrow">Live chats</p>
            <h1 className="provider-name" style={{ fontSize: 18 }}>Escalated conversations</h1>
          </div>
          <div style={{ width: 36 }} />
        </header>

        <section className="provider-section">
          {loadingQ ? (
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
          ))}
        </section>
      </div>
    )
  }

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
