import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SuppressionManagement } from '@/components/admin/suppression-management'
import { isoDateTime } from '@/lib/contracts/ids'
import type { PublicContentSuppressionSummary } from '@/lib/public-content-suppressions'

const suppression: PublicContentSuppressionSummary = {
  id: '00000000-0000-4000-8000-000000000001',
  targetType: 'domain',
  target: 'example.com',
  reason: 'Rights holder requested removal.',
  status: 'active',
  createdBy: 'admin-1',
  createdAt: isoDateTime('2026-09-10T12:00:00.000Z'),
  auditId: '00000000-0000-4000-8000-000000000002',
}

describe('SuppressionManagement', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows active and restored records with an explicit restore action', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          suppression: {
            ...suppression,
            status: 'restored',
            restoredBy: 'admin-2',
            restoredAt: '2026-09-10T13:00:00.000Z',
            restorationAuditId: '00000000-0000-4000-8000-000000000003',
          },
        }),
      }),
    )

    render(<SuppressionManagement initialSuppressions={[suppression]} />)
    expect(screen.getByText('Source domain')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Restore public content' }),
    )

    expect(confirm).toHaveBeenCalledWith(
      'Restore source domain “example.com”? Public content can become discoverable again if no other active suppression applies.',
    )
    expect(fetch).toHaveBeenCalledWith(
      `/api/v1/admin/public-content-suppressions/${suppression.id}/restore`,
      { method: 'POST' },
    )
    expect(
      await screen.findByText(
        'Restored with an audit entry. Public content was reopened only where no other active suppression applies.',
      ),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Restored')).not.toHaveLength(0)
    expect(
      screen.queryByRole('button', { name: 'Restore public content' }),
    ).not.toBeInTheDocument()
  })

  it('names an empty moderation state', () => {
    render(<SuppressionManagement initialSuppressions={[]} />)
    expect(
      screen.getByText('No suppression records have been created.'),
    ).toBeInTheDocument()
  })
})
