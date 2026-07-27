import { Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface SelectionActionBarProps {
  count: number
  onCancel: () => void
  onDeleteClick: () => void
}

/** Replaces the chat header while in selection mode — shared between the
 * mother's and provider's screens. */
export default function SelectionActionBar({ count, onCancel, onDeleteClick }: SelectionActionBarProps) {
  const { t } = useTranslation()
  return (
    <header className="chat-header dm-selection-bar">
      <button onClick={onCancel} className="chat-back" aria-label={t('cancel')}>
        <X size={18} />
      </button>
      <div className="chat-title">
        <div className="chat-title-row">
          <span>{t('chat_selected_count', { count })}</span>
        </div>
      </div>
      <button
        onClick={onDeleteClick}
        className="dm-selection-delete-btn"
        aria-label={t('chat_delete_selected')}
        disabled={count === 0}
      >
        <Trash2 size={18} />
      </button>
    </header>
  )
}
