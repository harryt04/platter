import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RecipeImportForm } from '@/components/recipes/recipe-import-form'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

describe('RecipeImportForm', () => {
  it('shows connected import guidance and durable statuses', () => {
    render(
      <RecipeImportForm
        initialImports={[
          {
            id: 'b6f9e7a7-5e44-46a3-bf5c-1d2b2cb9c2b7' as never,
            sourceUrl: 'https://example.com/recipe',
            status: 'queued',
            attemptCount: 0,
            submittedAt: '2026-09-10T12:00:00.000Z' as never,
            updatedAt: '2026-09-10T12:00:00.000Z' as never,
          },
        ]}
      />,
    )

    expect(screen.getByLabelText('Recipe URL')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Import recipe URL' }),
    ).toBeDisabled()
    expect(screen.getByText('Queued')).toBeInTheDocument()
    expect(
      screen.getByText(/never adds.*shopping run automatically/i),
    ).toBeInTheDocument()
  })
})
