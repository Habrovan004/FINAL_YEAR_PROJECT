import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, AlertCircle, Sparkles, Stethoscope, Loader2, WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../api/client'
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
  const { i18n, t } = useTranslation()
  const lang = i18n.language?.startsWith('sw') ? 'sw' : 'en'
  const [convo, setConvo] = useState<ConversationResponse | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [aiAvailable, setAiAvailable] = useState(true)
  const [sendError, setSendError] = useState('')
  const pollRef = useRef<number | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const open = async () => {
    setLoading(true)
    try {
      const r = await api.get(`/chatbot/conversation/?language=${lang}`)
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

  useEffect(() => { void open() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

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
    setSendError('')
    try {
      const r = await api.post('/chatbot/message/', {
        conversation_id: convo.id,
        content: text,
        language: lang,
      })
      setText('')
      const updated: ConversationResponse = { ...convo }
      updated.messages = [...convo.messages]
      if (r.data.message) updated.messages.push(r.data.message)
      if (r.data.bot_reply) updated.messages.push(r.data.bot_reply)
      if (r.data.conversation_type) updated.type = r.data.conversation_type
      if (r.data.escalated) updated.escalated_at = new Date().toISOString()
      setConvo(updated)
      // Backend tells us whether the AI service is currently reachable.
      if (typeof r.data.ai_available === 'boolean') {
        setAiAvailable(r.data.ai_available)
      }
    } catch (e) {
      console.error(e)
      setSendError(t('chat_send_failed'))
    } finally {
      setSending(false)
    }
  }

  if (loading || !convo) {
    return (
      <div className="chat-page chat-loading">
        <Loader2 className="chat-spin" size={28} />
      </div>
    )
  }

  const isLive = convo.type === 'provider'

  return (
    <div className="chat-page">
      <header className="chat-header">
        <button onClick={() => nav('/home')} className="chat-back" aria-label={t('back')}>
          <ArrowLeft size={18} />
        </button>
        <div className="chat-title">
          <div className="chat-title-row">
            {isLive ? <Stethoscope size={14} /> : <Sparkles size={14} />}
            <span>{isLive ? (convo.provider_name || t('provider')) : t('health_assistant')}</span>
          </div>
          <p className="chat-status">
            {isLive ? (
              <span className="chat-live"><span className="dot" /> {t('live_with_provider')}</span>
            ) : (
              <span className="chat-bot">{t('ai_subtitle')}</span>
            )}
          </p>
        </div>
      </header>

      {!aiAvailable && !isLive && (
        <div className="chat-warning-banner" role="status">
          <WifiOff size={14} />
          <span>{t('ai_unavailable_banner')}</span>
        </div>
      )}

      {convo.escalated_at && (
        <div className="chat-escalation-banner">
          <AlertCircle size={14} />
          <span>{t('escalated_banner')}</span>
        </div>
      )}

      <main className="chat-body">
        {convo.messages.map(m => {
          const fromMe = m.sender_type === 'mother'
          const label =
            m.sender_type === 'chatbot' ? t('health_assistant').toUpperCase()
              : m.sender_type === 'provider' ? (m.sender_name?.toUpperCase() || t('provider').toUpperCase())
                : t('you').toUpperCase()
          return (
            <div key={m.id} className={`bubble-wrap ${fromMe ? 'me' : 'other'}`}>
              <div className={`bubble bubble-${m.sender_type}`}>
                <p className="bubble-label">
                  {m.sender_type === 'chatbot' && <Sparkles size={9} />}
                  {m.sender_type === 'provider' && <Stethoscope size={9} />}
                  {label}
                  {m.triggered_escalation && ` • ${t('escalated_tag')}`}
                </p>
                <p className="bubble-text">{m.content}</p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </main>

      {sendError && (
        <div className="chat-error" role="alert">
          <AlertCircle size={14} /> <span>{sendError}</span>
        </div>
      )}

      <footer className="chat-footer">
        <input
          className="chat-input"
          placeholder={isLive ? t('chat_placeholder_provider') : t('chat_placeholder_ai')}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void send() }}
        />
        <button className="chat-send" onClick={() => void send()} disabled={sending || !text.trim()} aria-label={t('send')}>
          {sending ? <Loader2 className="chat-spin" size={16} /> : <Send size={16} />}
        </button>
      </footer>
    </div>
  )
}
