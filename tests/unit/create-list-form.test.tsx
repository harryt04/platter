import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CreateListForm } from '@/components/lists/create-list-form'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

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
