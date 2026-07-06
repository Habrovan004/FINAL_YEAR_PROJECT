import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, AlertCircle, Sparkles, Stethoscope, Loader2, WifiOff, ShieldAlert } from 'lucide-react'
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

interface ChatbotStatus {
  ai_available: boolean
  model: string
}

interface DirectMessage {
  id: number
  sender: number
  sender_name: string
  text: string
  is_read: boolean
  is_own: boolean
  created_at: string
}

interface ChatRoomRow {
  id: number
  provider_name: string
  last_message: { text: string; sender_id: number; created_at: string } | null
  unread_count: number
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
  const [status, setStatus] = useState<ChatbotStatus | null>(null)
  const [sendError, setSendError] = useState('')

  const [mode, setMode] = useState<'ai' | 'direct'>('ai')
  const [room, setRoom] = useState<ChatRoomRow | null>(null)
  const [roomLoading, setRoomLoading] = useState(true)
  const [roomMessages, setRoomMessages] = useState<DirectMessage[]>([])
  const [nextBefore, setNextBefore] = useState<number | null>(null)
  const [hasMoreOlder, setHasMoreOlder] = useState(false)
  const [directText, setDirectText] = useState('')
  const [directSending, setDirectSending] = useState(false)
  const [roomLoadedOnce, setRoomLoadedOnce] = useState(false)

  const pollRef = useRef<number | null>(null)
  const directPollRef = useRef<number | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  // ── Health-check the AI on mount so we can show the Online / Offline pill.
  useEffect(() => {
    let cancelled = false
    api.get<ChatbotStatus>('/chatbot/status/')
      .then(r => {
        if (cancelled) return
        setStatus(r.data)
        setAiAvailable(r.data.ai_available)
      })
      .catch(() => {
        if (cancelled) return
        setStatus({ ai_available: false, model: 'unknown' })
        setAiAvailable(false)
      })
    return () => { cancelled = true }
  }, [])

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
  }, [convo?.messages?.length, sending])

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

  // ── Direct provider chat (separate from the AI thread above) ──
  const loadRoom = async () => {
    setRoomLoading(true)
    try {
      const r = await api.get<ChatRoomRow[]>('/chat/rooms/')
      const active = r.data[0] || null
      setRoom(active)
      if (active) {
        await api.post(`/chat/rooms/${active.id}/mark-read/`).catch(() => {})
        const m = await api.get(`/chat/rooms/${active.id}/messages/`)
        setRoomMessages(m.data.results || [])
        setHasMoreOlder(Boolean(m.data.has_more))
        setNextBefore(m.data.next_before ?? null)
      }
    } catch {
      setRoom(null)
    } finally {
      setRoomLoading(false)
    }
  }

  const refreshRoomMessages = async () => {
    if (!room) return
    try {
      const m = await api.get(`/chat/rooms/${room.id}/messages/`)
      setRoomMessages(m.data.results || [])
      setHasMoreOlder(Boolean(m.data.has_more))
      setNextBefore(m.data.next_before ?? null)
    } catch { /* ignore */ }
  }

  const loadOlderRoomMessages = async () => {
    if (!room || !nextBefore) return
    try {
      const m = await api.get(`/chat/rooms/${room.id}/messages/?before=${nextBefore}`)
      setRoomMessages(prev => [...(m.data.results || []), ...prev])
      setHasMoreOlder(Boolean(m.data.has_more))
      setNextBefore(m.data.next_before ?? null)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (mode === 'direct' && !roomLoadedOnce) {
      setRoomLoadedOnce(true)
      void loadRoom()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, roomLoadedOnce])

  useEffect(() => {
    if (mode !== 'direct' || !room) return
    directPollRef.current = window.setInterval(() => void refreshRoomMessages(), 4000)
    return () => { if (directPollRef.current) window.clearInterval(directPollRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, room?.id])

  useEffect(() => {
    if (mode === 'direct') bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mode, roomMessages.length])

  const sendDirect = async () => {
    if (!room || !directText.trim() || directSending) return
    setDirectSending(true)
    try {
      const r = await api.post(`/chat/rooms/${room.id}/messages/`, { text: directText })
      setDirectText('')
      setRoomMessages(prev => [...prev, r.data])
    } catch (e) {
      console.error(e)
    } finally {
      setDirectSending(false)
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
  // While we wait for an AI reply we render an inline typing bubble.
  // Don't show it once the conversation has flipped to a live provider
  // (the bot is no longer in the loop).
  const showTyping = sending && !isLive

  const headerTitle = isLive
    ? t('chat_connected_nurse')
    : t('health_assistant')

  return (
    <div className={`chat-page ${isLive ? 'chat-page--live' : ''}`}>
      <header className={`chat-header ${isLive ? 'chat-header--live' : ''}`}>
        <button onClick={() => nav('/home')} className="chat-back" aria-label={t('back')}>
          <ArrowLeft size={18} />
        </button>
        <div className="chat-title">
          <div className="chat-title-row">
            {isLive ? <Stethoscope size={14} /> : <Sparkles size={14} />}
            <span>{headerTitle}</span>

            {/* AI status pill — hidden once a real nurse is on the line */}
            {!isLive && status && (
              <span
                className={`ai-status-pill ${aiAvailable ? 'ai-status-pill--on' : 'ai-status-pill--off'}`}
                title={status.model ? `Model: ${status.model}` : ''}
              >
                <span className="ai-status-dot" />
                {aiAvailable ? t('chat_ai_online') : t('chat_ai_offline')}
              </span>
            )}
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

      <div className="chat-tab-bar" role="tablist" aria-label="Chat mode">
        <button
          type="button" role="tab" aria-selected={mode === 'ai'}
          className={`chat-tab ${mode === 'ai' ? 'is-active' : ''}`}
          onClick={() => setMode('ai')}
        >
          <Sparkles size={13} /> {t('chat_tab_ai')}
        </button>
        <button
          type="button" role="tab" aria-selected={mode === 'direct'}
          className={`chat-tab ${mode === 'direct' ? 'is-active' : ''}`}
          onClick={() => setMode('direct')}
        >
          <Stethoscope size={13} /> {t('chat_tab_provider')}
          {room && room.unread_count > 0 && <span className="chat-tab-badge">{room.unread_count}</span>}
        </button>
      </div>

      {mode === 'ai' ? (
        <>
          {/* Always-on disclaimer just below the header */}
          <div className="chat-disclaimer" role="note">
            <ShieldAlert size={14} />
            <span>{t('chat_disclaimer')}</span>
          </div>

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

            {showTyping && (
              <div className="bubble-wrap other" aria-live="polite" aria-label={t('chat_typing')}>
                <div className="bubble bubble-chatbot typing-bubble">
                  <p className="bubble-label"><Sparkles size={9} /> {t('health_assistant').toUpperCase()}</p>
                  <div className="typing-dots" aria-hidden="true">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              </div>
            )}

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
        </>
      ) : (
        <>
          <main className="chat-body">
            {roomLoading ? (
              <div className="chat-loading" style={{ height: 200 }}>
                <Loader2 className="chat-spin" size={24} />
              </div>
            ) : !room ? (
              <p className="provider-empty" style={{ padding: '24px 12px', textAlign: 'center' }}>
                {t('chat_no_room_yet')}
              </p>
            ) : (
              <>
                {hasMoreOlder && (
                  <button type="button" className="chat-load-earlier" onClick={() => void loadOlderRoomMessages()}>
                    {t('chat_load_earlier')}
                  </button>
                )}
                {roomMessages.map(m => (
                  <div key={m.id} className={`bubble-wrap ${m.is_own ? 'me' : 'other'}`}>
                    <div className={`bubble ${m.is_own ? 'bubble-mother' : 'bubble-provider'}`}>
                      <p className="bubble-label">
                        {!m.is_own && <Stethoscope size={9} />}
                        {m.is_own ? t('you').toUpperCase() : (room.provider_name || t('provider')).toUpperCase()}
                      </p>
                      <p className="bubble-text">{m.text}</p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </>
            )}
          </main>

          {room && (
            <footer className="chat-footer">
              <input
                className="chat-input"
                placeholder={t('chat_placeholder_provider')}
                value={directText}
                onChange={e => setDirectText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void sendDirect() }}
              />
              <button className="chat-send" onClick={() => void sendDirect()} disabled={directSending || !directText.trim()} aria-label={t('send')}>
                {directSending ? <Loader2 className="chat-spin" size={16} /> : <Send size={16} />}
              </button>
            </footer>
          )}
        </>
      )}
    </div>
  )
}
