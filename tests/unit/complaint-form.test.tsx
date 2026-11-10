import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ComplaintForm } from '@/components/recipes/complaint-form'

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => cleanup())

describe('ComplaintForm', () => {
  it('prefills a linked recipe and submits a public-content report', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          complaint: {
            id: 'complaint-1',
            status: 'received',
            receivedAt: '2026-09-10T12:00:00.000Z',
          },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    )
    render(<ComplaintForm initialRecipeId="recipe-1" />)

    expect(screen.getByLabelText(/public recipe id/i)).toHaveValue('recipe-1')
    fireEvent.change(screen.getByLabelText(/what should we review/i), {
      target: { value: 'This source uses my work.' },
    })
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'owner@example.com' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Submit report' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/complaints',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          type: 'copyright',
          recipeId: 'recipe-1',
          sourceUrl: '',
          description: 'This source uses my work.',
          contactName: '',
          contactEmail: 'owner@example.com',
        }),
      }),
    )
    expect(
      await screen.findByText(/your report was received/i),
    ).toBeInTheDocument()
  })

  it('shows the server validation message when submission fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ detail: 'Provide a recipe id or source URL.' }),
        { status: 422 },
      ),
    )
    render(<ComplaintForm />)

    fireEvent.change(screen.getByLabelText(/what should we review/i), {
      target: { value: 'A concern.' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Submit report' }))

    expect(
      await screen.findByText('Provide a recipe id or source URL.'),
    ).toBeInTheDocument()
  })
})
