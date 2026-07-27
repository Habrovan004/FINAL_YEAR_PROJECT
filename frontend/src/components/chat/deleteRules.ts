import type { DirectMessage } from './types'

const DELETE_FOR_EVERYONE_WINDOW_MS = 15 * 60 * 1000

/** system messages and already-deleted placeholders can never be selected;
 * everything else (including visit_card, restricted to "for me" by the
 * dialog logic below) can. */
export function isSelectable(message: DirectMessage): boolean {
  return message.message_type !== 'system' && message.message_type !== 'deleted'
}

/** "Futa kwa wote" is only offered when EVERY selected message is the
 * caller's own, plain text (never visit_card — mirrors the backend's own
 * rule, which rejects visit_card for scope=everyone regardless of age),
 * and sent within the last 15 minutes. Any single disqualifying message in
 * a mixed selection falls back to "for me" only. */
export function canDeleteForEveryone(selected: DirectMessage[]): boolean {
  if (selected.length === 0) return false
  const now = Date.now()
  return selected.every(m => (
    m.is_own
    && m.message_type === 'text'
    && now - new Date(m.created_at).getTime() <= DELETE_FOR_EVERYONE_WINDOW_MS
  ))
}

/** Optimistic local update applied the instant the user confirms a delete,
 * before the server has responded. */
export function applyOptimisticDelete(
  messages: DirectMessage[], ids: number[], scope: 'me' | 'everyone',
): DirectMessage[] {
  if (scope === 'me') {
    return messages.filter(m => !ids.includes(m.id))
  }
  return messages.map(m => (
    ids.includes(m.id) ? { ...m, message_type: 'deleted' as const, text: '', visit_card: null } : m
  ))
}

/** Restores any server-rejected ids back to their pre-delete state, taken
 * from a snapshot captured before the optimistic update — everything the
 * server DID accept stays as the optimistic update left it. */
export function reconcileAfterDelete(
  current: DirectMessage[], snapshot: DirectMessage[], rejectedIds: number[], scope: 'me' | 'everyone',
): DirectMessage[] {
  if (rejectedIds.length === 0) return current

  if (scope === 'me') {
    // Re-insert restored messages in id order — they were filtered out
    // entirely by the optimistic update.
    let restored = current
    for (const rid of rejectedIds) {
      const original = snapshot.find(m => m.id === rid)
      if (!original || restored.some(m => m.id === rid)) continue
      const insertAt = restored.findIndex(m => m.id > rid)
      restored = insertAt === -1
        ? [...restored, original]
        : [...restored.slice(0, insertAt), original, ...restored.slice(insertAt)]
    }
    return restored
  }

  return current.map(m => {
    if (!rejectedIds.includes(m.id)) return m
    const original = snapshot.find(s => s.id === m.id)
    return original || m
  })
}
