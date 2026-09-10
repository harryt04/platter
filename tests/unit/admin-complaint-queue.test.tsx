import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ComplaintQueue } from '@/components/admin/complaint-queue'
import { isoDateTime } from '@/lib/contracts/ids'
import type { AdminComplaintSummary } from '@/lib/complaints'

const complaint: AdminComplaintSummary = {
  id: 'b6f9e7a7-5e44-46a3-bf5c-1d2b2cb9c2b7',
  type: 'copyright' as const,
  status: 'received' as const,
  recipeId: 'recipe-1',
  sourceUrl: 'https://example.com/recipe',
  description: 'Please review this public recipe.',
  contact: { name: 'Rights holder', email: 'rights@example.com' },
  receivedAt: isoDateTime('2026-09-10T12:00:00.000Z'),
  createdAt: isoDateTime('2026-09-10T12:00:00.000Z'),
  updatedAt: isoDateTime('2026-09-10T12:00:00.000Z'),
  statusHistory: [
    {
      status: 'received' as const,
      changedAt: isoDateTime('2026-09-10T12:00:00.000Z'),
      actorType: 'public-submission' as const,
    },
  ],
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ComplaintQueue', () => {
  it('shows restricted contact data and updates the queue after a transition', async () => {
    const user = userEvent.setup()
    const updated = { ...complaint, status: 'actioned' as const }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ complaint: updated }),
      }),
    )

    render(<ComplaintQueue initialComplaints={[complaint]} />)

    expect(
      screen.getByText('Rights holder · rights@example.com'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Please review this public recipe.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Move to actioned' }))

    expect(fetch).toHaveBeenCalledWith(
      `/api/v1/admin/complaints/${complaint.id}`,
      expect.objectContaining({ body: JSON.stringify({ status: 'actioned' }) }),
    )
    expect(await screen.findByText('Actioned')).toBeInTheDocument()
  })

  it('does not offer transitions for a closed complaint', () => {
    render(
      <ComplaintQueue
        initialComplaints={[{ ...complaint, status: 'closed' as const }]}
      />,
    )

    expect(screen.getByText('Closed')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Move to/i }),
    ).not.toBeInTheDocument()
  })
})
