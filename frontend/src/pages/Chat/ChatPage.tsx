import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, AlertCircle, Sparkles, Stethoscope, Loader2, WifiOff, ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../api/client'
import DirectMessageThread from '../../components/chat/DirectMessageThread'
import ChatComposer from '../../components/chat/ChatComposer'
import SelectionActionBar from '../../components/chat/SelectionActionBar'
import DeleteMessagesDialog from '../../components/chat/DeleteMessagesDialog'
import type { DirectMessage, ChatRoomRow } from '../../components/chat/types'
import { mergePolledMessages, resolveOptimisticMessage } from '../../components/chat/messageMerge'
import { applyOptimisticDelete, canDeleteForEveryone, reconcileAfterDelete } from '../../components/chat/deleteRules'
import NotificationBell from '../../components/layout/NotificationBell'
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
  const [noProviderAssigned, setNoProviderAssigned] = useState(false)
  const [roomLoading, setRoomLoading] = useState(true)
  const [roomMessages, setRoomMessages] = useState<DirectMessage[]>([])
  const [nextBefore, setNextBefore] = useState<number | null>(null)
  const [hasMoreOlder, setHasMoreOlder] = useState(false)
  const [directText, setDirectText] = useState('')
  const [directSending, setDirectSending] = useState(false)
  const [roomLoadedOnce, setRoomLoadedOnce] = useState(false)

  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const pollRef = useRef<number | null>(null)
  const directPollRef = useRef<number | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const lastMessageIdRef = useRef<number>(0)

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
  // A mother's room with her assigned provider is created (or fetched, if it
  // already exists) the moment she opens this tab — no separate "start chat"
  // step. If she has no assigned provider, the backend 400s with a
  // recognizable error code and we show a distinct empty state for that.
  const loadRoom = async () => {
    setRoomLoading(true)
    setNoProviderAssigned(false)
    try {
      const r = await api.post<ChatRoomRow>('/chat/rooms/')
      setRoom(r.data)
      await api.post(`/chat/rooms/${r.data.id}/mark-read/`).catch(() => {})
      const m = await api.get(`/chat/rooms/${r.data.id}/messages/`)
      const initial: DirectMessage[] = m.data.results || []
      setRoomMessages(initial)
      setHasMoreOlder(Boolean(m.data.has_more))
      setNextBefore(m.data.next_before ?? null)
      lastMessageIdRef.current = initial.reduce((max, msg) => Math.max(max, msg.id), 0)
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } }
      if (err.response?.data?.error === 'no_provider_assigned') {
        setNoProviderAssigned(true)
      }
      setRoom(null)
    } finally {
      setRoomLoading(false)
    }
  }

  // Incremental fetch — only messages newer than the last one we've seen,
  // never the whole thread. The backend marks anything addressed to us as
  // read as a side effect of this call and returns the fresh unread count.
  const pollNewRoomMessages = async () => {
    if (!room) return
    try {
      const m = await api.get(`/chat/rooms/${room.id}/messages/?after=${lastMessageIdRef.current}`)
      const fresh: DirectMessage[] = m.data.results || []
      if (fresh.length > 0) {
        setRoomMessages(prev => mergePolledMessages(prev, fresh))
        lastMessageIdRef.current = fresh.reduce((max, msg) => Math.max(max, msg.id), lastMessageIdRef.current)
      }
      if (typeof m.data.unread_count === 'number') {
        setRoom(prev => (prev ? { ...prev, unread_count: m.data.unread_count } : prev))
      }
    } catch { /* transient poll failure — next tick will retry */ }
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

  // Poll every 6s while the direct tab is open, but only while the tab/page
  // is actually visible — and fetch immediately the moment it regains focus,
  // so messages sent while backgrounded show up right away instead of
  // waiting for the next tick.
  useEffect(() => {
    if (mode !== 'direct' || !room) return

    const tick = () => { if (!document.hidden) void pollNewRoomMessages() }
    directPollRef.current = window.setInterval(tick, 6000)

    const onVisible = () => { if (!document.hidden) void pollNewRoomMessages() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      if (directPollRef.current) window.clearInterval(directPollRef.current)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, room?.id])

  useEffect(() => {
    if (mode === 'direct') bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mode, roomMessages.length])

  // Appends the message immediately (pending state) instead of waiting for
  // the server round-trip; on failure the bubble stays with a Retry action
  // rather than silently disappearing.
  const sendDirect = async () => {
    if (!room || !directText.trim() || directSending) return
    const body = directText.trim()
    const clientId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const optimistic: DirectMessage = {
      id: -1,
      sender: null,
      sender_name: t('you'),
      message_type: 'text',
      text: body,
      visit_card: null,
      is_read: false,
      read_at: null,
      is_own: true,
      created_at: new Date().toISOString(),
      clientId,
      pending: true,
    }
    setRoomMessages(prev => [...prev, optimistic])
    setDirectText('')
    setDirectSending(true)
    try {
      const r = await api.post(`/chat/rooms/${room.id}/messages/`, { type: 'text', text: body })
      setRoomMessages(prev => resolveOptimisticMessage(prev, clientId, r.data))
      lastMessageIdRef.current = Math.max(lastMessageIdRef.current, r.data.id)
    } catch (e) {
      console.error(e)
      setRoomMessages(prev => prev.map(m => (m.clientId === clientId ? { ...m, pending: false, failed: true } : m)))
    } finally {
      setDirectSending(false)
    }
  }

  const retryDirectSend = async (clientId: string) => {
    const target = roomMessages.find(m => m.clientId === clientId)
    if (!target || !room) return
    setRoomMessages(prev => prev.map(m => (m.clientId === clientId ? { ...m, pending: true, failed: false } : m)))
    try {
      const r = await api.post(`/chat/rooms/${room.id}/messages/`, { type: 'text', text: target.text })
      setRoomMessages(prev => resolveOptimisticMessage(prev, clientId, r.data))
      lastMessageIdRef.current = Math.max(lastMessageIdRef.current, r.data.id)
    } catch (e) {
      console.error(e)
      setRoomMessages(prev => prev.map(m => (m.clientId === clientId ? { ...m, pending: false, failed: true } : m)))
    }
  }

  // ── Selection mode: long-press / right-click / checkbox to select
  // messages, then delete "for me" or "for everyone" (own, recent, non-
  // system, non-visit_card only — enforced again server-side regardless). ──
  const enterSelection = (messageId: number) => {
    setSelectionMode(true)
    setSelectedIds(new Set([messageId]))
  }
  const toggleSelect = (messageId: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(messageId)) next.delete(messageId)
      else next.add(messageId)
      if (next.size === 0) setSelectionMode(false)
      return next
    })
  }
  const cancelSelection = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  const selectedMessages = roomMessages.filter(m => selectedIds.has(m.id))
  const everyoneEligible = canDeleteForEveryone(selectedMessages)

  const confirmDelete = async (scope: 'me' | 'everyone') => {
    const ids = Array.from(selectedIds)
    const snapshot = roomMessages
    setDeleteError('')
    setRoomMessages(prev => applyOptimisticDelete(prev, ids, scope))
    setDeleteDialogOpen(false)
    cancelSelection()

    try {
      const r = await api.post('/chat/messages/delete/', { message_ids: ids, scope })
      const rejectedIds: number[] = (r.data.rejected || []).map((x: { id: number }) => x.id)
      if (rejectedIds.length > 0) {
        setRoomMessages(prev => reconcileAfterDelete(prev, snapshot, rejectedIds, scope))
        setDeleteError(t('chat_delete_partial_rejected', { count: rejectedIds.length }))
      }
    } catch (e) {
      console.error(e)
      setRoomMessages(snapshot)
      setDeleteError(t('chat_delete_failed'))
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

  const directHeaderActive = mode === 'direct'

  return (
    <div className={`chat-page ${(isLive || directHeaderActive) ? 'chat-page--live' : ''}`}>
      {selectionMode && mode === 'direct' ? (
        <SelectionActionBar
          count={selectedIds.size}
          onCancel={cancelSelection}
          onDeleteClick={() => setDeleteDialogOpen(true)}
        />
      ) : (
      <header className={`chat-header ${(isLive || directHeaderActive) ? 'chat-header--live' : ''}`}>
        <button onClick={() => nav('/home')} className="chat-back" aria-label={t('back')}>
          <ArrowLeft size={18} />
        </button>
        {mode === 'direct' ? (
          <>
            <div className="chat-avatar-circle">
              {(room?.provider_name || t('provider')).charAt(0).toUpperCase()}
            </div>
            <div className="chat-title">
              <div className="chat-title-row">
                <span>{room?.provider_name || t('provider')}</span>
              </div>
              <p className="chat-status">
                {room?.provider_hospital || t('chat_tab_provider')}
              </p>
            </div>
            <NotificationBell variant="inline" />
          </>
        ) : (
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
        )}
      </header>
      )}

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
          <main className="chat-direct-shell">
            {roomLoading ? (
              <div className="chat-loading" style={{ height: 200 }}>
                <Loader2 className="chat-spin" size={24} />
              </div>
            ) : noProviderAssigned ? (
              <p className="provider-empty" style={{ padding: '24px 12px', textAlign: 'center' }}>
                {t('chat_no_provider_assigned')}
              </p>
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
                <DirectMessageThread
                  messages={roomMessages}
                  otherPartyLabel={room.provider_name || t('provider')}
                  onRetry={clientId => void retryDirectSend(clientId)}
                  lang={lang}
                  emptyHint={t('chat_start_conversation_hint')}
                  selectionMode={selectionMode}
                  selectedIds={selectedIds}
                  onEnterSelection={enterSelection}
                  onToggleSelect={toggleSelect}
                />
              </>
            )}
          </main>

          {deleteError && (
            <div className="chat-error" role="alert">
              <AlertCircle size={14} /> <span>{deleteError}</span>
            </div>
          )}

          {!noProviderAssigned && !roomLoading && !selectionMode && (
            <ChatComposer
              value={directText}
              onChange={setDirectText}
              onSend={() => void sendDirect()}
              sending={directSending}
              placeholder={t('chat_placeholder_direct')}
            />
          )}

          <DeleteMessagesDialog
            open={deleteDialogOpen}
            count={selectedIds.size}
            canDeleteForEveryone={everyoneEligible}
            onClose={() => setDeleteDialogOpen(false)}
            onConfirm={scope => void confirmDelete(scope)}
          />
        </>
      )}
    </div>
  )
}
