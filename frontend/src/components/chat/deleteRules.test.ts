import { describe, expect, it } from 'vitest'
import { applyOptimisticDelete, canDeleteForEveryone, isSelectable, reconcileAfterDelete } from './deleteRules'
import type { DirectMessage } from './types'

function msg(overrides: Partial<DirectMessage> & { id: number }): DirectMessage {
  return {
    sender: 1, sender_name: 'Test', message_type: 'text', text: 'hello',
    visit_card: null, is_read: false, read_at: null, is_own: true,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('isSelectable', () => {
  it('is false for system messages', () => {
    expect(isSelectable(msg({ id: 1, message_type: 'system' }))).toBe(false)
  })
  it('is false for already-deleted placeholders', () => {
    expect(isSelectable(msg({ id: 1, message_type: 'deleted' }))).toBe(false)
  })
  it('is true for text messages', () => {
    expect(isSelectable(msg({ id: 1, message_type: 'text' }))).toBe(true)
  })
  it('is true for visit_card messages (selectable, but "for me" only — enforced by canDeleteForEveryone)', () => {
    expect(isSelectable(msg({ id: 1, message_type: 'visit_card' }))).toBe(true)
  })
})

describe('canDeleteForEveryone', () => {
  it('is false for an empty selection', () => {
    expect(canDeleteForEveryone([])).toBe(false)
  })

  it('is true when every selected message is own, text, and recent', () => {
    const now = new Date().toISOString()
    const selected = [
      msg({ id: 1, is_own: true, message_type: 'text', created_at: now }),
      msg({ id: 2, is_own: true, message_type: 'text', created_at: now }),
    ]
    expect(canDeleteForEveryone(selected)).toBe(true)
  })

  it('is false when the selection is mixed with another party\'s message', () => {
    const now = new Date().toISOString()
    const selected = [
      msg({ id: 1, is_own: true, message_type: 'text', created_at: now }),
      msg({ id: 2, is_own: false, message_type: 'text', created_at: now }),
    ]
    expect(canDeleteForEveryone(selected)).toBe(false)
  })

  it('is false when the selection includes a visit_card, even if own and recent', () => {
    const now = new Date().toISOString()
    const selected = [
      msg({ id: 1, is_own: true, message_type: 'text', created_at: now }),
      msg({ id: 2, is_own: true, message_type: 'visit_card', created_at: now }),
    ]
    expect(canDeleteForEveryone(selected)).toBe(false)
  })

  it('is false when a selected own message is older than 15 minutes', () => {
    const old = new Date(Date.now() - 16 * 60 * 1000).toISOString()
    const selected = [msg({ id: 1, is_own: true, message_type: 'text', created_at: old })]
    expect(canDeleteForEveryone(selected)).toBe(false)
  })

  it('is true at exactly the 15-minute boundary', () => {
    const boundary = new Date(Date.now() - 15 * 60 * 1000 + 1000).toISOString()
    const selected = [msg({ id: 1, is_own: true, message_type: 'text', created_at: boundary })]
    expect(canDeleteForEveryone(selected)).toBe(true)
  })
})

describe('applyOptimisticDelete', () => {
  it('scope "me" removes the messages from local state entirely', () => {
    const messages = [msg({ id: 1 }), msg({ id: 2 }), msg({ id: 3 })]
    const result = applyOptimisticDelete(messages, [2], 'me')
    expect(result.map(m => m.id)).toEqual([1, 3])
  })

  it('scope "everyone" swaps the message to the deleted placeholder in place', () => {
    const messages = [msg({ id: 1, text: 'secret' }), msg({ id: 2 })]
    const result = applyOptimisticDelete(messages, [1], 'everyone')
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe(1)
    expect(result[0].message_type).toBe('deleted')
    expect(result[0].text).toBe('')
  })
})

describe('reconcileAfterDelete', () => {
  it('restores a rejected "for me" hide back into its original position', () => {
    const snapshot = [msg({ id: 1 }), msg({ id: 2 }), msg({ id: 3 })]
    const afterOptimistic = applyOptimisticDelete(snapshot, [2], 'me')
    const result = reconcileAfterDelete(afterOptimistic, snapshot, [2], 'me')
    expect(result.map(m => m.id)).toEqual([1, 2, 3])
  })

  it('restores a rejected "for everyone" delete back to its original content', () => {
    const snapshot = [msg({ id: 1, text: 'original content' })]
    const afterOptimistic = applyOptimisticDelete(snapshot, [1], 'everyone')
    const result = reconcileAfterDelete(afterOptimistic, snapshot, [1], 'everyone')
    expect(result[0].message_type).toBe('text')
    expect(result[0].text).toBe('original content')
  })

  it('leaves accepted deletions alone — only rejected ids are restored', () => {
    const snapshot = [msg({ id: 1, text: 'a' }), msg({ id: 2, text: 'b' })]
    const afterOptimistic = applyOptimisticDelete(snapshot, [1, 2], 'everyone')
    const result = reconcileAfterDelete(afterOptimistic, snapshot, [2], 'everyone')
    expect(result[0].message_type).toBe('deleted') // id 1 stayed deleted (accepted)
    expect(result[1].message_type).toBe('text')    // id 2 restored (rejected)
    expect(result[1].text).toBe('b')
  })

  it('is a no-op when nothing was rejected', () => {
    const snapshot = [msg({ id: 1 })]
    const current = applyOptimisticDelete(snapshot, [1], 'everyone')
    const result = reconcileAfterDelete(current, snapshot, [], 'everyone')
    expect(result).toBe(current)
  })
})
