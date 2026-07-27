import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Send, Loader2, ClipboardList } from 'lucide-react'
import api from '../../api/client'
import DirectMessageThread from '../../components/chat/DirectMessageThread'
import ChatComposer from '../../components/chat/ChatComposer'
import SelectionActionBar from '../../components/chat/SelectionActionBar'
import DeleteMessagesDialog from '../../components/chat/DeleteMessagesDialog'
import ANCRecordsPanel, { type ANCVisitRecord } from '../../components/chat/ANCRecordsPanel'
import type { DirectMessage, ChatRoomRow } from '../../components/chat/types'
import { mergePolledMessages, resolveOptimisticMessage } from '../../components/chat/messageMerge'
import { applyOptimisticDelete, canDeleteForEveryone, reconcileAfterDelete } from '../../components/chat/deleteRules'
import NotificationBell from '../../components/layout/NotificationBell'
import '../Chat/chat.css'
import './provider.css'

interface QueueRow {
  id: number
  mother_id: number
  mother_name: string
  type: string
  escalated_at: string | null
  updated_at: string
}

interface Msg {
  id: number
  sender_type: 'chatbot' | 'mother' | 'provider' | 'system'
  sender_name: string
  content: string
  message_type: 'text' | 'visit_summary' | 'system'
  metadata: Record<string, any>
  triggered_escalation: boolean
  created_at: string
}

type RoomRow = ChatRoomRow & { patient: number; patient_name: string }

interface AssignedPatient {
  id: number
  full_name: string
}

type Tab = 'escalated' | 'direct'

export default function ProviderChatQueue() {
  const nav = useNavigate()
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.startsWith('sw') ? 'sw' : 'en'
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

  // ── ANC Records slide-over (escalated thread) ──
  const [ancPanelOpen, setAncPanelOpen] = useState(false)
  const [insertingVisitId, setInsertingVisitId] = useState<number | null>(null)
  const [ancInsertError, setAncInsertError] = useState('')

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
  const lastRoomMessageIdRef = useRef<number>(0)

  // ── ANC Records slide-over (direct thread) ──
  const [directAncPanelOpen, setDirectAncPanelOpen] = useState(false)
  const [directInsertingVisitId, setDirectInsertingVisitId] = useState<number | null>(null)
  const [directAncInsertError, setDirectAncInsertError] = useState('')

  // ── Message selection / delete (direct thread) ──
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteError, setDeleteError] = useState('')

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

  // Close the records panel whenever a different conversation is opened so
  // stale state from the previous mother isn't shown.
  useEffect(() => {
    setAncPanelOpen(false)
    setAncInsertError('')
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

  const activeMotherId = queue.find(q => q.id === active)?.mother_id

  const insertVisit = async (visit: ANCVisitRecord) => {
    if (!active || insertingVisitId) return
    setInsertingVisitId(visit.id)
    setAncInsertError('')
    try {
      const r = await api.post('/chatbot/provider/insert-visit/', {
        conversation_id: active,
        visit_id: visit.id,
      })
      setMessages(prev => [...prev, r.data])
      setAncPanelOpen(false)
    } catch {
      setAncInsertError(t('anc_insert_error'))
    } finally {
      setInsertingVisitId(null)
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

  const loadInitialRoomMessages = async (roomId: number) => {
    try {
      const r = await api.get(`/chat/rooms/${roomId}/messages/`)
      const initial: DirectMessage[] = r.data.results || []
      setRoomMessages(initial)
      lastRoomMessageIdRef.current = initial.reduce((max, msg) => Math.max(max, msg.id), 0)
    } catch {
      setRoomMessages([])
    }
  }

  // Incremental fetch — only messages newer than the last one seen, never
  // the whole thread. Marks anything addressed to us as read as a side
  // effect and refreshes this room's unread badge from the response.
  const pollNewRoomMessages = async (roomId: number) => {
    try {
      const r = await api.get(`/chat/rooms/${roomId}/messages/?after=${lastRoomMessageIdRef.current}`)
      const fresh: DirectMessage[] = r.data.results || []
      if (fresh.length > 0) {
        setRoomMessages(prev => mergePolledMessages(prev, fresh))
        lastRoomMessageIdRef.current = fresh.reduce((max, msg) => Math.max(max, msg.id), lastRoomMessageIdRef.current)
      }
      if (typeof r.data.unread_count === 'number') {
        setRooms(prev => prev.map(row => (row.id === roomId ? { ...row, unread_count: r.data.unread_count } : row)))
      }
    } catch { /* transient poll failure — next tick will retry */ }
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
    setDirectAncPanelOpen(false)
    void api.post(`/chat/rooms/${activeRoom}/mark-read/`).catch(() => {})
    void loadInitialRoomMessages(activeRoom)
  }, [activeRoom])

  // Same 6-second, visibility-gated, cursor-based polling as the mother's
  // direct tab — never refetches the whole thread.
  useEffect(() => {
    if (activeRoom == null) return

    const tick = () => { if (!document.hidden) void pollNewRoomMessages(activeRoom) }
    roomPollRef.current = window.setInterval(tick, 6000)

    const onVisible = () => { if (!document.hidden) void pollNewRoomMessages(activeRoom) }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      if (roomPollRef.current) window.clearInterval(roomPollRef.current)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [activeRoom])

  // Optimistic send — appends immediately with a pending state; on failure
  // the bubble stays with a Retry action instead of disappearing.
  const sendRoom = async () => {
    if (!activeRoom || !roomText.trim() || roomSending) return
    const body = roomText.trim()
    const clientId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const optimistic: DirectMessage = {
      id: -1,
      sender: null,
      sender_name: 'You',
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
    setRoomText('')
    setRoomSending(true)
    try {
      const r = await api.post(`/chat/rooms/${activeRoom}/messages/`, { type: 'text', text: body })
      setRoomMessages(prev => resolveOptimisticMessage(prev, clientId, r.data))
      lastRoomMessageIdRef.current = Math.max(lastRoomMessageIdRef.current, r.data.id)
    } catch (e) {
      console.error(e)
      setRoomMessages(prev => prev.map(m => (m.clientId === clientId ? { ...m, pending: false, failed: true } : m)))
    } finally {
      setRoomSending(false)
    }
  }

  const retryRoomSend = async (clientId: string) => {
    const target = roomMessages.find(m => m.clientId === clientId)
    if (!target || !activeRoom) return
    setRoomMessages(prev => prev.map(m => (m.clientId === clientId ? { ...m, pending: true, failed: false } : m)))
    try {
      const r = await api.post(`/chat/rooms/${activeRoom}/messages/`, { type: 'text', text: target.text })
      setRoomMessages(prev => resolveOptimisticMessage(prev, clientId, r.data))
      lastRoomMessageIdRef.current = Math.max(lastRoomMessageIdRef.current, r.data.id)
    } catch (e) {
      console.error(e)
      setRoomMessages(prev => prev.map(m => (m.clientId === clientId ? { ...m, pending: false, failed: true } : m)))
    }
  }

  const insertDirectVisit = async (visit: ANCVisitRecord) => {
    if (!activeRoom || directInsertingVisitId) return
    setDirectInsertingVisitId(visit.id)
    setDirectAncInsertError('')
    try {
      const r = await api.post(`/chat/rooms/${activeRoom}/messages/`, { type: 'visit_card', visit_id: visit.id })
      setRoomMessages(prev => [...prev, r.data])
      lastRoomMessageIdRef.current = Math.max(lastRoomMessageIdRef.current, r.data.id)
      setDirectAncPanelOpen(false)
    } catch {
      setDirectAncInsertError(t('anc_insert_error'))
    } finally {
      setDirectInsertingVisitId(null)
    }
  }

  const activeRoomInfo = rooms.find(r => r.id === activeRoom)

  // ── Message selection / delete — same rules as the mother's screen ──
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

  const selectedRoomMessages = roomMessages.filter(m => selectedIds.has(m.id))
  const everyoneEligible = canDeleteForEveryone(selectedRoomMessages)

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

  // ── Escalated conversation thread ──
  if (tab === 'escalated' && active) {
    return (
      <div className="provider-page" style={{ paddingBottom: 80 }}>
        <header className="provider-header">
          <button onClick={() => setActive(null)} className="provider-logout"><ArrowLeft size={16} /></button>
          <div className="flex-1 text-center">
            <p className="provider-eyebrow">{t('provider_chat_live_label')}</p>
            <h1 className="provider-name" style={{ fontSize: 16 }}>{t('provider_chat_conversation_number', { id: active })}</h1>
          </div>
          <button
            onClick={() => setAncPanelOpen(o => !o)}
            className="provider-logout"
            title={t('anc_records_title')}
            disabled={!activeMotherId}
            style={{ opacity: activeMotherId ? 1 : 0.4 }}
          >
            <ClipboardList size={16} />
          </button>
        </header>

        <section className="provider-section" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {messages.length === 0 && <p className="provider-empty">{t('chat_no_messages_yet')}</p>}
          {messages.map(m => {
            if (m.message_type === 'system') {
              return (
                <div key={m.id} style={{ textAlign: 'center', margin: '10px 0' }}>
                  <span style={{
                    display: 'inline-block', fontSize: 11, color: 'var(--pv-text-muted)',
                    background: 'var(--pv-chip-bg)', padding: '4px 10px', borderRadius: 999,
                  }}>
                    {m.content}
                  </span>
                </div>
              )
            }
            if (m.message_type === 'visit_summary') {
              const v = m.metadata || {}
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                  <div style={{
                    maxWidth: '82%', padding: '10px 12px', borderRadius: 14, fontSize: 12,
                    background: '#eef2ff', color: '#111827', border: '1px solid #c7d2fe',
                  }}>
                    <p style={{ fontSize: 9, fontWeight: 700, marginBottom: 6, opacity: 0.7 }}>
                      {t('provider_visit_summary_label')} · {v.visit_date ? new Date(v.visit_date).toLocaleDateString(lang) : ''}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 10px' }}>
                      <span>{t('visit_card_week')}: {v.gestational_age_weeks ?? '—'}</span>
                      <span>BP: {v.blood_pressure_systolic ?? '—'}/{v.blood_pressure_diastolic ?? '—'}</span>
                      <span>{t('visit_card_weight')}: {v.weight_kg ?? '—'} kg</span>
                      <span>Hb: {v.hemoglobin_g_dl ?? '—'} g/dL</span>
                      <span>{t('visit_card_risk')}: {(v.risk_level || '—').toUpperCase()}</span>
                      <span>{t('visit_card_complications')}: {v.complications || '—'}</span>
                    </div>
                    {v.next_appointment_date && (
                      <p style={{ marginTop: 6, fontSize: 11, opacity: 0.8 }}>
                        {t('visit_card_next_appointment')}: {new Date(v.next_appointment_date).toLocaleDateString(lang)}
                      </p>
                    )}
                  </div>
                </div>
              )
            }
            return (
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
                    {m.sender_type === 'chatbot' ? t('health_assistant').toUpperCase() : m.sender_name.toUpperCase()}
                    {m.triggered_escalation && ` • ${t('escalated_tag')}`}
                  </p>
                  {m.content}
                </div>
              </div>
            )
          })}
        </section>

        <div style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          maxWidth: 480, width: '100%', padding: 12, background: '#fff', borderTop: '1px solid #f3f4f6',
          display: 'flex', gap: 8,
        }}>
          <input
            className="field-input"
            placeholder={t('provider_reply_to_mother_placeholder')}
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

        <ANCRecordsPanel
          open={ancPanelOpen}
          motherId={activeMotherId}
          onClose={() => setAncPanelOpen(false)}
          onInsert={insertVisit}
          insertingVisitId={insertingVisitId}
          insertError={ancInsertError}
        />
      </div>
    )
  }

  // ── Direct message thread ──
  if (tab === 'direct' && activeRoom) {
    return (
      <div className="provider-page" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', padding: '18px 16px 0' }}>
        {selectionMode ? (
          <SelectionActionBar
            count={selectedIds.size}
            onCancel={cancelSelection}
            onDeleteClick={() => setDeleteDialogOpen(true)}
          />
        ) : (
        <header className="provider-header">
          <button onClick={() => { setActiveRoom(null); void loadRooms() }} className="provider-logout"><ArrowLeft size={16} /></button>
          <div className="chat-avatar-circle">
            {(activeRoomInfo?.patient_name || t('mother_fallback_label')).charAt(0).toUpperCase()}
          </div>
          <div className="flex-1" style={{ minWidth: 0 }}>
            <h1 className="provider-name" style={{ fontSize: 16 }}>{activeRoomInfo?.patient_name || t('mother_fallback_label')}</h1>
            <p className="provider-eyebrow" style={{ marginTop: 2 }}>{t('role_mama')}</p>
          </div>
          <NotificationBell variant="inline" />
          <button
            onClick={() => setDirectAncPanelOpen(o => !o)}
            className="provider-logout"
            title={t('anc_records_title')}
            disabled={!activeRoomInfo?.patient}
            style={{ opacity: activeRoomInfo?.patient ? 1 : 0.4 }}
          >
            <ClipboardList size={16} />
          </button>
        </header>
        )}

        <section className="provider-section" style={{ flex: 1, minHeight: 0, display: 'flex', margin: '14px 0 0' }}>
          <DirectMessageThread
            messages={roomMessages}
            otherPartyLabel={activeRoomInfo?.patient_name || t('mother_fallback_label')}
            onRetry={clientId => void retryRoomSend(clientId)}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onEnterSelection={enterSelection}
            onToggleSelect={toggleSelect}
            lang={lang}
            emptyHint={t('chat_start_conversation_hint')}
          />
        </section>

        {deleteError && (
          <p style={{ color: 'var(--pv-error)', fontSize: '0.75rem', padding: '6px 2px', margin: 0 }}>{deleteError}</p>
        )}

        {!selectionMode && (
          <ChatComposer
            value={roomText}
            onChange={setRoomText}
            onSend={() => void sendRoom()}
            sending={roomSending}
            placeholder={t('provider_message_mother_placeholder')}
          />
        )}

        <DeleteMessagesDialog
          open={deleteDialogOpen}
          count={selectedIds.size}
          canDeleteForEveryone={everyoneEligible}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={scope => void confirmDelete(scope)}
        />

        <ANCRecordsPanel
          open={directAncPanelOpen}
          motherId={activeRoomInfo?.patient}
          onClose={() => setDirectAncPanelOpen(false)}
          onInsert={insertDirectVisit}
          insertingVisitId={directInsertingVisitId}
          insertError={directAncInsertError}
        />
      </div>
    )
  }

  // ── List view (either tab) ──
  return (
    <div className="provider-page">
      <header className="provider-header">
        <button onClick={() => nav('/provider/dashboard')} className="provider-logout"><ArrowLeft size={16} /></button>
        <div className="flex-1 text-center">
          <p className="provider-eyebrow">{t('provider_messages_eyebrow')}</p>
          <h1 className="provider-name" style={{ fontSize: 18 }}>
            {tab === 'escalated' ? t('provider_title_escalated_conversations') : t('provider_title_direct_messages')}
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
          {t('provider_tab_escalated')} {queue.length > 0 && `(${queue.length})`}
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
          {t('provider_tab_direct')} {rooms.some(r => r.unread_count > 0) && `(${rooms.reduce((s, r) => s + r.unread_count, 0)})`}
        </button>
      </div>

      <section className="provider-section">
        {tab === 'escalated' ? (
          loadingQ ? (
            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-rose-400" /></div>
          ) : queue.length === 0 ? (
            <p className="provider-empty">{t('provider_no_escalated_chats')}</p>
          ) : queue.map(q => (
            <button key={q.id} className="chat-row" onClick={() => setActive(q.id)}>
              <div>
                <p className="alert-patient">{q.mother_name}</p>
                <p className="alert-meta">{t('provider_tab_escalated')} {q.escalated_at ? new Date(q.escalated_at).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }) : ''}</p>
              </div>
              <span className="badge-red">{t('provider_live_badge')}</span>
            </button>
          ))
        ) : (
          loadingRooms || loadingPatients ? (
            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-rose-400" /></div>
          ) : rooms.length === 0 && patientsWithoutRoom.length === 0 ? (
            <p className="provider-empty">{t('provider_no_assigned_patients')}</p>
          ) : (
            <>
              {rooms.map(r => (
                <button key={r.id} className="chat-row" onClick={() => setActiveRoom(r.id)}>
                  <div className="chat-row-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <p className="alert-patient">{r.patient_name}</p>
                      {r.last_message && (
                        <span style={{ fontSize: '0.625rem', color: 'var(--pv-text-muted)', flexShrink: 0 }}>
                          {new Date(r.last_message.created_at).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p className="alert-meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.last_message?.text || t('chat_no_messages_yet')}
                    </p>
                  </div>
                  {r.unread_count > 0 && <span className="badge-red">{r.unread_count}</span>}
                </button>
              ))}
              {patientsWithoutRoom.map(p => (
                <div key={p.id} className="chat-row">
                  <div className="chat-row-body">
                    <p className="alert-patient">{p.full_name}</p>
                    <p className="alert-meta">{t('provider_no_conversation_yet')}</p>
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
                    {startingChatFor === p.id ? <Loader2 className="animate-spin" size={12} /> : t('provider_start_message_btn')}
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
