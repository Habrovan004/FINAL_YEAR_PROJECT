import { useTranslation } from 'react-i18next'

interface DeleteMessagesDialogProps {
  open: boolean
  count: number
  canDeleteForEveryone: boolean
  onClose: () => void
  onConfirm: (scope: 'me' | 'everyone') => void
}

/** Bottom-sheet delete-scope picker — shared between both chat screens. */
export default function DeleteMessagesDialog({
  open, count, canDeleteForEveryone, onClose, onConfirm,
}: DeleteMessagesDialogProps) {
  const { t } = useTranslation()

  if (!open) return null

  return (
    <div className="dm-dialog-backdrop" onClick={onClose}>
      <div className="dm-dialog-sheet" onClick={e => e.stopPropagation()}>
        <p className="dm-dialog-title">{t('chat_delete_dialog_title', { count })}</p>

        <button
          type="button"
          className="dm-dialog-option"
          onClick={() => onConfirm('me')}
        >
          {t('chat_delete_for_me')}
        </button>

        {canDeleteForEveryone ? (
          <button
            type="button"
            className="dm-dialog-option dm-dialog-option--destructive"
            onClick={() => onConfirm('everyone')}
          >
            {t('chat_delete_for_everyone')}
          </button>
        ) : (
          <p className="dm-dialog-note">{t('chat_delete_everyone_unavailable')}</p>
        )}

        <button type="button" className="dm-dialog-cancel" onClick={onClose}>
          {t('cancel')}
        </button>
      </div>
    </div>
  )
}
