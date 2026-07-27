import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '../../i18n'
import DirectMessageThread from './DirectMessageThread'
import type { DirectMessage } from './types'

function msg(overrides: Partial<DirectMessage> & { id: number }): DirectMessage {
  return {
    sender: 1, sender_name: 'Test', message_type: 'text', text: 'hello',
    visit_card: null, is_read: false, read_at: null, is_own: false,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

const noSelection = {
  selectionMode: false,
  selectedIds: new Set<number>(),
  onEnterSelection: () => {},
  onToggleSelect: () => {},
}

describe('DirectMessageThread grouping', () => {
  it('shows exactly one timestamp per 5-minute group, on the last bubble', () => {
    const base = new Date('2026-07-26T10:00:00Z').getTime()
    const t = (mins: number) => new Date(base + mins * 60000).toISOString()

    const messages: DirectMessage[] = [
      msg({ id: 1, is_own: true, created_at: t(0) }),
      msg({ id: 2, is_own: true, created_at: t(1) }),  // same group as 1 (1 min apart)
      msg({ id: 3, is_own: true, created_at: t(10) }), // new group (8 min gap from msg 2)
    ]

    const { container } = render(
      <DirectMessageThread messages={messages} otherPartyLabel="Dr Test" onRetry={() => {}} lang="en" emptyHint="empty" {...noSelection} />,
    )

    // One timestamp for the {1,2} group, one for the {3} group — never one per bubble.
    expect(container.querySelectorAll('.bubble-time')).toHaveLength(2)
  })

  it('shows the other party name once above a group, not on every bubble', () => {
    const base = new Date('2026-07-26T10:00:00Z').getTime()
    const t = (mins: number) => new Date(base + mins * 60000).toISOString()

    const messages: DirectMessage[] = [
      msg({ id: 1, is_own: false, created_at: t(0) }),
      msg({ id: 2, is_own: false, created_at: t(1) }),
    ]

    render(
      <DirectMessageThread messages={messages} otherPartyLabel="Dr Test" onRetry={() => {}} lang="en" emptyHint="empty" {...noSelection} />,
    )

    expect(screen.getAllByText('Dr Test')).toHaveLength(1)
  })

  it('never shows a sender label on own messages', () => {
    const messages: DirectMessage[] = [msg({ id: 1, is_own: true })]
    const { container } = render(
      <DirectMessageThread messages={messages} otherPartyLabel="Dr Test" onRetry={() => {}} lang="en" emptyHint="empty" {...noSelection} />,
    )
    expect(container.querySelector('.dm-group-sender')).not.toBeInTheDocument()
  })

  it('shows the read receipt only under the single latest read own message', () => {
    const base = new Date('2026-07-26T10:00:00Z').getTime()
    const t = (mins: number) => new Date(base + mins * 60000).toISOString()
    const messages: DirectMessage[] = [
      msg({ id: 1, is_own: true, created_at: t(0), read_at: t(0.5) }),
      msg({ id: 2, is_own: true, created_at: t(20), read_at: t(20.5) }), // latest read — only this one gets the receipt
    ]
    const { container } = render(
      <DirectMessageThread messages={messages} otherPartyLabel="Dr Test" onRetry={() => {}} lang="en" emptyHint="empty" {...noSelection} />,
    )
    expect(container.querySelectorAll('.dm-read-receipt')).toHaveLength(1)
  })

  it('shows no read receipt when no own message has been read yet', () => {
    const messages: DirectMessage[] = [msg({ id: 1, is_own: true, read_at: null })]
    const { container } = render(
      <DirectMessageThread messages={messages} otherPartyLabel="Dr Test" onRetry={() => {}} lang="en" emptyHint="empty" {...noSelection} />,
    )
    expect(container.querySelectorAll('.dm-read-receipt')).toHaveLength(0)
  })
})

describe('DirectMessageThread selection mode', () => {
  it('renders no selection checkbox for a system message', () => {
    const messages: DirectMessage[] = [msg({ id: 1, message_type: 'system', text: 'Provider changed.' })]
    const { container } = render(
      <DirectMessageThread messages={messages} otherPartyLabel="Dr Test" onRetry={() => {}} lang="en" emptyHint="empty" {...noSelection} />,
    )
    expect(container.querySelector('.dm-select-checkbox')).not.toBeInTheDocument()
  })

  it('renders no selection checkbox for an already-deleted placeholder', () => {
    const messages: DirectMessage[] = [msg({ id: 1, message_type: 'deleted', text: '' })]
    const { container } = render(
      <DirectMessageThread messages={messages} otherPartyLabel="Dr Test" onRetry={() => {}} lang="en" emptyHint="empty" {...noSelection} />,
    )
    expect(container.querySelector('.dm-select-checkbox')).not.toBeInTheDocument()
  })

  it('renders a selection checkbox for a plain text message', () => {
    const messages: DirectMessage[] = [msg({ id: 1, message_type: 'text' })]
    const { container } = render(
      <DirectMessageThread messages={messages} otherPartyLabel="Dr Test" onRetry={() => {}} lang="en" emptyHint="empty" {...noSelection} />,
    )
    expect(container.querySelector('.dm-select-checkbox')).toBeInTheDocument()
  })

  it('clicking the checkbox while not yet in selection mode calls onEnterSelection with that message id', () => {
    const onEnterSelection = vi.fn()
    const messages: DirectMessage[] = [msg({ id: 42, message_type: 'text' })]
    const { container } = render(
      <DirectMessageThread
        messages={messages} otherPartyLabel="Dr Test" onRetry={() => {}} lang="en" emptyHint="empty"
        {...noSelection} onEnterSelection={onEnterSelection}
      />,
    )
    fireEvent.click(container.querySelector('.dm-select-checkbox')!)
    expect(onEnterSelection).toHaveBeenCalledWith(42)
  })

  it('clicking the checkbox while already in selection mode calls onToggleSelect instead', () => {
    const onEnterSelection = vi.fn()
    const onToggleSelect = vi.fn()
    const messages: DirectMessage[] = [msg({ id: 42, message_type: 'text' })]
    const { container } = render(
      <DirectMessageThread
        messages={messages} otherPartyLabel="Dr Test" onRetry={() => {}} lang="en" emptyHint="empty"
        selectionMode selectedIds={new Set<number>()} onEnterSelection={onEnterSelection} onToggleSelect={onToggleSelect}
      />,
    )
    fireEvent.click(container.querySelector('.dm-select-checkbox')!)
    expect(onToggleSelect).toHaveBeenCalledWith(42)
    expect(onEnterSelection).not.toHaveBeenCalled()
  })

  it('clicking the bubble itself (not just the checkbox) toggles selection while in selection mode', () => {
    const onToggleSelect = vi.fn()
    const messages: DirectMessage[] = [msg({ id: 7, message_type: 'text' })]
    const { container } = render(
      <DirectMessageThread
        messages={messages} otherPartyLabel="Dr Test" onRetry={() => {}} lang="en" emptyHint="empty"
        selectionMode selectedIds={new Set<number>()} onEnterSelection={() => {}} onToggleSelect={onToggleSelect}
      />,
    )
    fireEvent.click(container.querySelector('.bubble')!)
    expect(onToggleSelect).toHaveBeenCalledWith(7)
  })

  it('does not toggle selection on bubble click when not in selection mode', () => {
    const onToggleSelect = vi.fn()
    const messages: DirectMessage[] = [msg({ id: 7, message_type: 'text' })]
    const { container } = render(
      <DirectMessageThread
        messages={messages} otherPartyLabel="Dr Test" onRetry={() => {}} lang="en" emptyHint="empty"
        {...noSelection} onToggleSelect={onToggleSelect}
      />,
    )
    fireEvent.click(container.querySelector('.bubble')!)
    expect(onToggleSelect).not.toHaveBeenCalled()
  })
})
