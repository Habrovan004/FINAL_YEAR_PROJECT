import { describe, expect, it } from 'vitest'
import { mergePolledMessages, resolveOptimisticMessage } from './messageMerge'
import type { DirectMessage } from './types'

function makeOptimistic(clientId: string, text = 'hi'): DirectMessage {
  return {
    id: -1, sender: null, sender_name: 'You', message_type: 'text', text,
    visit_card: null, is_read: false, read_at: null, is_own: true,
    created_at: new Date().toISOString(), clientId, pending: true,
  }
}

function makeServerMessage(id: number, text = 'hi'): DirectMessage {
  return {
    id, sender: 1, sender_name: 'You', message_type: 'text', text,
    visit_card: null, is_read: false, read_at: null, is_own: true,
    created_at: new Date().toISOString(),
  }
}

describe('mergePolledMessages', () => {
  it('appends messages whose id is not already present', () => {
    const prev = [makeServerMessage(1)]
    const result = mergePolledMessages(prev, [makeServerMessage(2)])
    expect(result.map(m => m.id)).toEqual([1, 2])
  })

  it('skips messages whose id is already present (defensive re-fetch)', () => {
    const prev = [makeServerMessage(1), makeServerMessage(2)]
    const result = mergePolledMessages(prev, [makeServerMessage(2), makeServerMessage(3)])
    expect(result.map(m => m.id)).toEqual([1, 2, 3])
  })

  it('ignores the sentinel id -1 used by pending optimistic entries', () => {
    const prev = [makeOptimistic('c1')]
    const result = mergePolledMessages(prev, [makeServerMessage(1)])
    expect(result).toHaveLength(2)
  })

  it('returns the same array reference when nothing new arrives', () => {
    const prev = [makeServerMessage(1)]
    const result = mergePolledMessages(prev, [makeServerMessage(1)])
    expect(result).toBe(prev)
  })
})

describe('resolveOptimisticMessage', () => {
  it('replaces the optimistic entry with the server message (POST resolves first)', () => {
    const clientId = 'c1'
    const prev = [makeOptimistic(clientId)]
    const server = makeServerMessage(42)
    const result = resolveOptimisticMessage(prev, clientId, server)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(42)
    expect(result[0].pending).toBeUndefined()
  })

  it('drops the optimistic entry instead of duplicating when a poll already added the same id (poll wins the race)', () => {
    const clientId = 'c1'
    const server = makeServerMessage(42)
    // Simulates: optimistic entry still pending, but a poll tick already
    // fetched and appended the real row under no clientId.
    const prev = [makeOptimistic(clientId), server]
    const result = resolveOptimisticMessage(prev, clientId, server)
    expect(result.filter(m => m.id === 42)).toHaveLength(1)
    expect(result.some(m => m.clientId === clientId)).toBe(false)
  })

  it('retry produces exactly one message even if a poll lands between retry and its response', () => {
    const clientId = 'c1'
    let state: DirectMessage[] = [makeOptimistic(clientId, 'retry me')]

    // First attempt fails.
    state = state.map(m => (m.clientId === clientId ? { ...m, pending: false, failed: true } : m))
    expect(state[0].failed).toBe(true)

    // User retries — pending again.
    state = state.map(m => (m.clientId === clientId ? { ...m, pending: true, failed: false } : m))

    // A poll tick fetches the now-committed row before the retry's own POST resolves.
    const server = makeServerMessage(99, 'retry me')
    state = mergePolledMessages(state, [server])
    expect(state).toHaveLength(2) // optimistic placeholder + polled real message

    // Retry's POST now resolves.
    state = resolveOptimisticMessage(state, clientId, server)
    expect(state.filter(m => m.id === 99)).toHaveLength(1)
    expect(state).toHaveLength(1)
  })
})
