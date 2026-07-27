import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '../../i18n'
import DeleteMessagesDialog from './DeleteMessagesDialog'

describe('DeleteMessagesDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <DeleteMessagesDialog open={false} count={1} canDeleteForEveryone onClose={() => {}} onConfirm={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('offers both scopes when every selected message is own and recent', () => {
    render(
      <DeleteMessagesDialog open count={2} canDeleteForEveryone onClose={() => {}} onConfirm={() => {}} />,
    )
    expect(screen.getByText('Delete for me')).toBeInTheDocument()
    expect(screen.getByText('Delete for everyone')).toBeInTheDocument()
    expect(screen.queryByText(/only available/i)).not.toBeInTheDocument()
  })

  it('offers only "for me" plus an explanatory note for a mixed/ineligible selection', () => {
    render(
      <DeleteMessagesDialog open count={2} canDeleteForEveryone={false} onClose={() => {}} onConfirm={() => {}} />,
    )
    expect(screen.getByText('Delete for me')).toBeInTheDocument()
    expect(screen.queryByText('Delete for everyone')).not.toBeInTheDocument()
    expect(screen.getByText(/only available/i)).toBeInTheDocument()
  })

  it('calls onConfirm("me") when "Delete for me" is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <DeleteMessagesDialog open count={1} canDeleteForEveryone onClose={() => {}} onConfirm={onConfirm} />,
    )
    fireEvent.click(screen.getByText('Delete for me'))
    expect(onConfirm).toHaveBeenCalledWith('me')
  })

  it('calls onConfirm("everyone") when "Delete for everyone" is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <DeleteMessagesDialog open count={1} canDeleteForEveryone onClose={() => {}} onConfirm={onConfirm} />,
    )
    fireEvent.click(screen.getByText('Delete for everyone'))
    expect(onConfirm).toHaveBeenCalledWith('everyone')
  })

  it('calls onClose when the cancel button is clicked', () => {
    const onClose = vi.fn()
    render(
      <DeleteMessagesDialog open count={1} canDeleteForEveryone onClose={onClose} onConfirm={() => {}} />,
    )
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })
})
