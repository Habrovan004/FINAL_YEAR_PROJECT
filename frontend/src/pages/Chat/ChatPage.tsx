import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, AlertCircle, Sparkles, Stethoscope, Loader2 } from 'lucide-react'
import api from '../../api/client'
import { useTranslation } from 'react-i18next'
import './chat.css'

interface Msg {
  id: number
  sender_type: 'chatbot' | 'mother' | 'provider'
  sender_name: string
  content: string
  triggered_escalation: boolean
  created_at: string
}

interface ConversationResponse {
  id: number
  mother_name: string
  provider_name: string | null
  type: 'chatbot' | 'provider'
  escalated_at: string | null
  messages: Msg[]
}

export default function ChatPage() {
  const nav = useNavigate()
  const { i18n } = useTranslation()
  const [convo, setConvo] = useState<ConversationResponse | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const pollRef = useRef<number | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const open = async () => {
    setLoading(true)
    try {
      const r = await api.get('/chatbot/conversation/')
      setConvo(r.data)
    } finally {
      setLoading(false)
    }
  }

  const refresh = async () => {
    if (!convo) return
    try {
      const r = await api.get(`/chatbot/conversation/${convo.id}/messages/`)
      setConvo(r.data)
    } catch { /* ignore */ }
  }

  useEffect(() => { void open() }, [])

  // When the conversation is with a live provider, poll every 4s for replies.
  useEffect(() => {
    if (!convo) return
    if (convo.type === 'provider') {
      pollRef.current = window.setInterval(() => void refresh(), 4000)
    }
    return () => { if (pollRef.current) window.clearInterval(pollRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convo?.id, convo?.type])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [convo?.messages?.length])

  const send = async () => {
    if (!convo || !text.trim() || sending) return
    setSending(true)
    try {
      const r = await api.post('/chatbot/message/', {
        conversation_id: convo.id,
        content: text,
        language: i18n.language?.startsWith('sw') ? 'sw' : 'en',
      })
      setText('')
      // Append new messages locally for snappy UX, then refresh from server.
      const updated: ConversationResponse = { ...convo }
      updated.messages = [...convo.messages]
      if (r.data.message) updated.messages.push(r.data.message)
      if (r.data.bot_reply) updated.messages.push(r.data.bot_reply)
      if (r.data.conversation_type) updated.type = r.data.conversation_type
      if (r.data.escalated) updated.escalated_at = new Date().toISOString()
      setConvo(updated)
    } catch (e) {
      console.error(e)
    } finally {
      setSending(false)
    }
  }

  if (loading || !convo) {
    return (
      <div className="chat-page flex items-center justify-center">
        <Loader2 className="animate-spin text-rose-400" size={28} />
      </div>
    )
  }

  const isLive = convo.type === 'provider'

  return (
    <div className="chat-page">
      <header className="chat-header">
        <button onClick={() => nav('/home')} className="chat-back"><ArrowLeft size={18} /></button>
        <div className="chat-title">
          <div className="chat-title-row">
            {isLive ? <Stethoscope size={14} /> : <Sparkles size={14} />}
            <span>{isLive ? (convo.provider_name || 'Provider') : 'Health Assistant'}</span>
          </div>
          <p className="chat-status">
            {isLive ? <span className="chat-live"><span className="dot" /> Live with provider</span>
                    : <span className="chat-bot">Bot — say "I need a doctor" to reach a real provider</span>}
          </p>
        </div>
      </header>

      {convo.escalated_at && (
        <div className="chat-escalation-banner">
          <AlertCircle size={14} />
          <span>This conversation has been escalated to a real provider.</span>
        </div>
      )}

      <main className="chat-body">
        {convo.messages.map(m => {
          const fromMe = m.sender_type === 'mother'
          const label = m.sender_type === 'chatbot' ? 'HEALTH ASSISTANT'
                      : m.sender_type === 'provider' ? (m.sender_name?.toUpperCase() || 'PROVIDER')
                      : 'YOU'
          return (
            <div key={m.id} className={`bubble-wrap ${fromMe ? 'me' : 'other'}`}>
              <div className={`bubble bubble-${m.sender_type}`}>
                <p className="bubble-label">
                  {m.sender_type === 'chatbot' && <Sparkles size={9} />}
                  {m.sender_type === 'provider' && <Stethoscope size={9} />}
                  {label}
                  {m.triggered_escalation && ' • ESCALATED'}
                </p>
                <p className="bubble-text">{m.content}</p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </main>

      <footer className="chat-footer">
        <input
          className="chat-input"
          placeholder={isLive ? 'Message the provider…' : 'Ask about nutrition, danger signs, ANC…'}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void send() }}
        />
        <button className="chat-send" onClick={() => void send()} disabled={sending || !text.trim()}>
          {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
        </button>
      </footer>
    </div>
  )
}
