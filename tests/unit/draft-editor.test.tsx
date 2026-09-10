import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DraftEditor } from '@/components/recipes/draft-editor'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

describe('DraftEditor', () => {
  it('makes the title-only draft action and privacy state clear', () => {
    render(<DraftEditor />)

    expect(screen.getByRole('textbox', { name: 'Recipe title' })).toBeRequired()
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled()
    expect(
      screen.getByText('Private until you choose to share or publish it.'),
    ).toBeInTheDocument()
  })
})
