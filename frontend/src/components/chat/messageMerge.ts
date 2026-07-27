import type { DirectMessage } from './types'

/**
 * Appends freshly-polled messages, skipping any whose real id is already
 * present in state. Guards against the poll racing an in-flight optimistic
 * send: if the server already committed the row, a poll tick can fetch it by
 * id before the POST response reaches the client.
 */
export function mergePolledMessages(prev: DirectMessage[], fresh: DirectMessage[]): DirectMessage[] {
  const existingIds = new Set(prev.filter(m => m.id !== -1).map(m => m.id))
  const deduped = fresh.filter(m => !existingIds.has(m.id))
  return deduped.length > 0 ? [...prev, ...deduped] : prev
}

/**
 * Resolves an optimistic (pending) entry once its POST succeeds, matched by
 * `clientId`. If a poll already appended the same server message under a
 * different entry (the other order of the same race — poll wins first),
 * drop the optimistic placeholder instead of adding a second copy of the
 * same message.
 */
export function resolveOptimisticMessage(
  prev: DirectMessage[], clientId: string, serverMessage: DirectMessage,
): DirectMessage[] {
  const alreadyPolled = prev.some(m => m.id === serverMessage.id && m.clientId !== clientId)
  if (alreadyPolled) {
    return prev.filter(m => m.clientId !== clientId)
  }
  return prev.map(m => (m.clientId === clientId ? { ...serverMessage, clientId } : m))
}
