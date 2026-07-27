import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '../../i18n'
import SelectionActionBar from './SelectionActionBar'

describe('SelectionActionBar', () => {
  it('shows the selected count', () => {
    render(<SelectionActionBar count={3} onCancel={() => {}} onDeleteClick={() => {}} />)
    expect(screen.getByText('3 selected')).toBeInTheDocument()
  })

  it('disables the delete button when nothing is selected', () => {
    render(<SelectionActionBar count={0} onCancel={() => {}} onDeleteClick={() => {}} />)
    expect(screen.getByLabelText('Delete selected')).toBeDisabled()
  })

  it('enables the delete button once something is selected', () => {
    render(<SelectionActionBar count={1} onCancel={() => {}} onDeleteClick={() => {}} />)
    expect(screen.getByLabelText('Delete selected')).toBeEnabled()
  })

  it('calls onCancel when the X button is clicked (exits selection mode)', () => {
    const onCancel = vi.fn()
    render(<SelectionActionBar count={1} onCancel={onCancel} onDeleteClick={() => {}} />)
    fireEvent.click(screen.getByLabelText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onDeleteClick when the trash button is clicked', () => {
    const onDeleteClick = vi.fn()
    render(<SelectionActionBar count={1} onCancel={() => {}} onDeleteClick={onDeleteClick} />)
    fireEvent.click(screen.getByLabelText('Delete selected'))
    expect(onDeleteClick).toHaveBeenCalled()
  })
})
