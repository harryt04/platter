import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CreateListForm } from '@/components/lists/create-list-form'
import { RenameListForm } from '@/components/lists/rename-list-form'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

afterEach(cleanup)

describe('CreateListForm', () => {
  it('makes the list name and one primary creation action clear', () => {
    render(<CreateListForm />)

    expect(screen.getByRole('textbox', { name: 'List name' })).toBeRequired()
    expect(
      screen.getByText(
        /This starts a shared space with one empty shopping run/,
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create list' })).toBeEnabled()
  })
})

describe('RenameListForm', () => {
  it('makes the shared owner-only rename behavior clear', () => {
    render(<RenameListForm listId="list-1" currentName="Family" />)

    expect(screen.getByRole('textbox', { name: 'List name' })).toHaveValue(
      'Family',
    )
    expect(
      screen.getByText('Only owners can change this name for everyone.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save name' })).toBeEnabled()
  })
})
