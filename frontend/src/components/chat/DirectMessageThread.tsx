import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown, Ban, Check, CheckCheck, Loader2, RefreshCw, Stethoscope } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DirectMessage } from './types'
import { isSelectable } from './deleteRules'
// Self-contained: pulls in the shared bubble/date-separator/visit-card/
// pending-failed styles so any consumer gets correct rendering without
// having to remember to import chat.css separately.
import '../../pages/Chat/chat.css'

const LONG_PRESS_MS = 500

const NEAR_BOTTOM_PX = 120
const GROUP_WINDOW_MS = 5 * 60 * 1000

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

function formatTime(iso: string, lang: string): string {
  return new Date(iso).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })
}

/** Two text bubbles from the same side, within 5 minutes, on the same day,
 * belong to the same visual group — reduced gap, one label, one timestamp. */
function sameGroup(a: DirectMessage | undefined, b: DirectMessage | undefined): boolean {
  if (!a || !b) return false
  if (a.message_type !== 'text' || b.message_type !== 'text') return false
  if (a.is_own !== b.is_own) return false
  if (!isSameDay(a.created_at, b.created_at)) return false
  return Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) <= GROUP_WINDOW_MS
}

function riskLabel(t: (key: string) => string, level: string): string {
  const key = `visit_card_risk_${level.toLowerCase()}`
  const translated = t(key)
  return translated === key ? level.toUpperCase() : translated.toUpperCase()
}

function complicationsLabel(t: (key: string) => string, raw: string): string {
  return raw === 'None' ? t('visit_card_complications_none') : raw
}

/** True if the NEXT message starts a new date separator — i.e. this message
 * is the last one of its day, so it must end its group regardless of the
 * 5-minute window. */
function showSeparatorNext(messages: DirectMessage[], idx: number): boolean {
  const next = messages[idx + 1]
  return !next || !isSameDay(messages[idx].created_at, next.created_at)
}

interface DirectMessageThreadProps {
  messages: DirectMessage[]
  /** Display name for whichever party isn't the caller — the provider's name
   * on the mother's screen, or the mother's name on the provider's screen. */
  otherPartyLabel: string
  onRetry: (clientId: string) => void
  lang: string
  emptyHint: string
  selectionMode: boolean
  selectedIds: Set<number>
  /** Long-press (touch) or right-click/checkbox-click (desktop) on a
   * selectable message not yet in selection mode — enters it with that
   * message selected. */
  onEnterSelection: (messageId: number) => void
  onToggleSelect: (messageId: number) => void
}

function messageKey(m: DirectMessage): string | number {
  return m.clientId || m.id
}

/** The direct-chat message list — shared verbatim between the mother's and
 * provider's chat screens so bubble styling, date separators, system
 * messages, visit cards, optimistic-send states, and scroll behaviour never
 * drift apart. Owns its own scroll container: anchors to the bottom, keeps
 * the position stable when older history is prepended, and only auto-scrolls
 * on new incoming messages when the reader is already near the bottom (own
 * sent messages always scroll into view, since the sender should always see
 * what they just sent).
 */
export default function DirectMessageThread({
  messages, otherPartyLabel, onRetry, lang, emptyHint,
  selectionMode, selectedIds, onEnterSelection, onToggleSelect,
}: DirectMessageThreadProps) {
  const { t } = useTranslation()

  const containerRef = useRef<HTMLDivElement>(null)
  const longPressTimerRef = useRef<number | null>(null)

  const startLongPress = (id: number) => {
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = window.setTimeout(() => onEnterSelection(id), LONG_PRESS_MS)
  }
  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }
  const handleContextMenu = (e: React.MouseEvent, id: number) => {
    e.preventDefault()
    if (selectionMode) onToggleSelect(id)
    else onEnterSelection(id)
  }
  const handleBubbleClick = (id: number) => {
    if (selectionMode) onToggleSelect(id)
  }
  const wasNearBottomRef = useRef(true)
  const hasMountedRef = useRef(false)
  const prevMessagesRef = useRef<DirectMessage[]>([])
  const prevScrollHeightRef = useRef(0)
  const [showNewMessageChip, setShowNewMessageChip] = useState(false)

  const isNearBottom = () => {
    const el = containerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
  }

  const scrollToBottom = (behavior: ScrollBehavior) => {
    const el = containerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
    setShowNewMessageChip(false)
  }

  const handleScroll = () => {
    wasNearBottomRef.current = isNearBottom()
    if (wasNearBottomRef.current) setShowNewMessageChip(false)
  }

  // Runs before paint so the user never sees an intermediate wrong scroll
  // position (e.g. jumping to the top before we correct it back).
  useLayoutEffect(() => {
    const el = containerRef.current
    const prevMessages = prevMessagesRef.current

    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      if (el) el.scrollTop = el.scrollHeight
      wasNearBottomRef.current = true
    } else {
      const prevFirstKey = prevMessages[0] ? messageKey(prevMessages[0]) : null
      const currentFirstKey = messages[0] ? messageKey(messages[0]) : null
      const isPrepend = prevFirstKey !== null && currentFirstKey !== null && currentFirstKey !== prevFirstKey

      if (isPrepend && el) {
        // Older history was loaded above the current view — keep whatever
        // the reader was looking at in the same place, instead of letting
        // the newly-inserted content push it down or jump them to the top.
        el.scrollTop = el.scrollHeight - prevScrollHeightRef.current
      } else {
        const appended = messages.slice(prevMessages.length)
        const hasOwnAppended = appended.some(m => m.is_own || m.pending)
        if (hasOwnAppended || wasNearBottomRef.current) {
          scrollToBottom('smooth')
        } else if (appended.length > 0) {
          setShowNewMessageChip(true)
        }
      }
    }

    prevMessagesRef.current = messages
    prevScrollHeightRef.current = el?.scrollHeight ?? 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  if (messages.length === 0) {
    return <p className="provider-empty" style={{ padding: '24px 12px', textAlign: 'center' }}>{emptyHint}</p>
  }

  // The single "Imesomwa" receipt goes under the LAST own message that's
  // been read — never one per bubble. A deleted message never carries it,
  // even if it was the most recently read before being deleted.
  let lastReadOwnIdx = -1
  messages.forEach((m, i) => { if (m.is_own && m.read_at && m.message_type !== 'deleted') lastReadOwnIdx = i })

  const renderCheckbox = (m: DirectMessage) => {
    if (!isSelectable(m)) return null
    const checked = selectedIds.has(m.id)
    return (
      <button
        type="button"
        className={`dm-select-checkbox ${checked ? 'is-checked' : ''} ${selectionMode ? 'is-visible' : ''}`}
        onClick={e => {
          e.stopPropagation()
          if (selectionMode) onToggleSelect(m.id)
          else onEnterSelection(m.id)
        }}
        aria-label={checked ? t('chat_deselect_message') : t('chat_select_message')}
      >
        {checked && <Check size={12} />}
      </button>
    )
  }

  return (
    <div className="dm-thread-wrap">
      <div className="dm-thread-scroll" ref={containerRef} onScroll={handleScroll}>
      {messages.map((m, idx) => {
        const showSeparator = idx === 0 || !isSameDay(messages[idx - 1].created_at, m.created_at)
        const key = m.clientId || m.id

        const isGroupStart = showSeparator || !sameGroup(messages[idx - 1], m)
        const isGroupEnd = idx === messages.length - 1 || showSeparatorNext(messages, idx) || !sameGroup(m, messages[idx + 1])
        const tightSpacing = !isGroupStart

        const dayLabel = () => {
          const today = new Date()
          const yesterday = new Date(today)
          yesterday.setDate(today.getDate() - 1)
          if (isSameDay(m.created_at, today.toISOString())) return t('chat_date_today')
          if (isSameDay(m.created_at, yesterday.toISOString())) return t('chat_date_yesterday')
          return new Date(m.created_at).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })
        }

        return (
          <div key={key} style={{ marginTop: showSeparator ? 0 : (tightSpacing ? 2 : 10) }}>
            {showSeparator && (
              <div className="chat-date-separator"><span>{dayLabel()}</span></div>
            )}

            {m.message_type === 'system' ? (
              <div className="chat-system-msg"><span>{m.text}</span></div>
            ) : m.message_type === 'deleted' ? (
              // No checkbox, no timestamp, no context-menu/long-press handlers
              // — not selectable, and there's nothing left to act on. Side
              // alignment and group position stay put so the thread flow
              // doesn't jump around when a message gets deleted.
              <div className={`bubble-wrap ${m.is_own ? 'me' : 'other'}`}>
                <div className="dm-bubble-row">
                  <div className="bubble dm-bubble-deleted">
                    <Ban size={12} />
                    <span>{t('chat_message_deleted')}</span>
                  </div>
                </div>
              </div>
            ) : m.message_type === 'visit_card' && m.visit_card ? (
              <div className={`bubble-wrap ${m.is_own ? 'me' : 'other'}`}>
                <div className="dm-bubble-row">
                  {m.is_own && renderCheckbox(m)}
                  <div
                    className="bubble visit-card-bubble"
                    onClick={() => handleBubbleClick(m.id)}
                    onContextMenu={e => handleContextMenu(e, m.id)}
                    onTouchStart={() => isSelectable(m) && startLongPress(m.id)}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                  >
                    <p className="bubble-label">
                      <Stethoscope size={9} />
                      {t('visit_card_title')} · {new Date(m.visit_card.visit_date).toLocaleDateString(lang)}
                    </p>
                    <div className="visit-card-grid">
                      <span>{t('visit_card_week')}: {m.visit_card.gestational_age_weeks}</span>
                      <span>BP: {m.visit_card.blood_pressure_systolic}/{m.visit_card.blood_pressure_diastolic}</span>
                      <span>{t('visit_card_weight')}: {m.visit_card.weight_kg} kg</span>
                      <span>Hb: {m.visit_card.hemoglobin_g_dl ?? '—'}</span>
                      <span>{t('visit_card_risk')}: {riskLabel(t, m.visit_card.risk_level)}</span>
                      <span>{complicationsLabel(t, m.visit_card.complications)}</span>
                    </div>
                    {m.visit_card.next_appointment_date && (
                      <p className="visit-card-next">
                        {t('visit_card_next_appointment')}: {new Date(m.visit_card.next_appointment_date).toLocaleDateString(lang)}
                      </p>
                    )}
                  </div>
                  {!m.is_own && renderCheckbox(m)}
                </div>
              </div>
            ) : (
              <div className={`bubble-wrap ${m.is_own ? 'me' : 'other'}`}>
                {!m.is_own && isGroupStart && (
                  <p className="dm-group-sender">{otherPartyLabel}</p>
                )}
                <div className="dm-bubble-row">
                  {m.is_own && renderCheckbox(m)}
                  <div
                    className={`bubble ${m.is_own ? 'dm-bubble-own' : 'dm-bubble-other'} ${tightSpacing ? 'dm-bubble-grouped' : ''} ${m.failed ? 'bubble-failed' : ''}`}
                    onClick={() => handleBubbleClick(m.id)}
                    onContextMenu={e => handleContextMenu(e, m.id)}
                    onTouchStart={() => isSelectable(m) && startLongPress(m.id)}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                  >
                    <p className="bubble-text">{m.text}</p>
                    {!m.pending && !m.failed && isGroupEnd && (
                      <p className="bubble-time">{formatTime(m.created_at, lang)}</p>
                    )}
                    {m.pending && (
                      <p className="bubble-status">
                        <Loader2 className="chat-spin" size={10} /> {t('chat_sending')}
                      </p>
                    )}
                    {m.failed && (
                      <button
                        type="button"
                        className="bubble-retry"
                        onClick={e => { e.stopPropagation(); if (m.clientId) onRetry(m.clientId) }}
                      >
                        <RefreshCw size={10} /> {t('chat_retry')}
                      </button>
                    )}
                  </div>
                  {!m.is_own && renderCheckbox(m)}
                </div>
                {idx === lastReadOwnIdx && (
                  <p className="dm-read-receipt"><CheckCheck size={11} /> {t('chat_read_receipt')}</p>
                )}
              </div>
            )}
          </div>
        )
      })}
      </div>
      {showNewMessageChip && (
        <button
          type="button"
          className="dm-new-message-chip"
          onClick={() => scrollToBottom('smooth')}
        >
          {t('chat_new_message_chip')} <ArrowDown size={12} />
        </button>
      )}
    </div>
  )
}
