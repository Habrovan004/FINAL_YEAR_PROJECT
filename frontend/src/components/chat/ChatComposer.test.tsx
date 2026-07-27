import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '../../i18n'
import ChatComposer from './ChatComposer'

describe('ChatComposer', () => {
  it('disables the send button when the input is empty', () => {
    render(<ChatComposer value="" onChange={() => {}} onSend={() => {}} sending={false} placeholder="Write…" />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('disables the send button when the input is only whitespace', () => {
    render(<ChatComposer value="   " onChange={() => {}} onSend={() => {}} sending={false} placeholder="Write…" />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('enables the send button once there is real text', () => {
    render(<ChatComposer value="hello" onChange={() => {}} onSend={() => {}} sending={false} placeholder="Write…" />)
    expect(screen.getByRole('button')).toBeEnabled()
  })

  it('disables the send button while a send is in flight', () => {
    render(<ChatComposer value="hello" onChange={() => {}} onSend={() => {}} sending placeholder="Write…" />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('sends on Enter without Shift', () => {
    const onSend = vi.fn()
    render(<ChatComposer value="hello" onChange={() => {}} onSend={onSend} sending={false} placeholder="Write…" />)
    fireEvent.keyDown(screen.getByPlaceholderText('Write…'), { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('does not send on Shift+Enter (newline instead)', () => {
    const onSend = vi.fn()
    render(<ChatComposer value="hello" onChange={() => {}} onSend={onSend} sending={false} placeholder="Write…" />)
    fireEvent.keyDown(screen.getByPlaceholderText('Write…'), { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('does not send on Enter when the value is empty/whitespace', () => {
    const onSend = vi.fn()
    render(<ChatComposer value="   " onChange={() => {}} onSend={onSend} sending={false} placeholder="Write…" />)
    fireEvent.keyDown(screen.getByPlaceholderText('Write…'), { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
  })
})
