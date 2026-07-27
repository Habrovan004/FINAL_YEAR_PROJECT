import { useEffect, useRef } from 'react'
import { Loader2, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const MAX_HEIGHT_PX = 120

interface ChatComposerProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  sending: boolean
  placeholder: string
  disabled?: boolean
}

/** The direct-chat input bar — shared between the mother's and provider's
 * screens so Enter-to-send, Shift+Enter-for-newline, the disabled/enabled
 * send button, and the pill/circle styling never drift apart. */
export default function ChatComposer({ value, onChange, onSend, sending, placeholder, disabled }: ChatComposerProps) {
  const { t } = useTranslation()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim() && !sending && !disabled) onSend()
    }
  }

  return (
    <footer className="chat-footer">
      <textarea
        ref={textareaRef}
        className="chat-input"
        rows={1}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
      <button
        type="button"
        className="chat-send"
        onClick={onSend}
        disabled={disabled || sending || !value.trim()}
        aria-label={t('send')}
      >
        {sending ? <Loader2 className="chat-spin" size={16} /> : <Send size={16} />}
      </button>
    </footer>
  )
}
