import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountExportPanel } from '@/components/settings/account-export-panel'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AccountExportPanel', () => {
  it('requests an export and offers the private download link', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          export: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            status: 'ready',
            createdAt: '2026-09-10T00:00:00.000Z',
            expiresAt: '2026-09-11T00:00:00.000Z',
            downloadUrl:
              '/api/v1/account/exports/550e8400-e29b-41d4-a716-446655440000',
          },
        }),
        { status: 201 },
      ),
    )

    render(<AccountExportPanel />)
    expect(screen.getByText(/available for 24 hours/i)).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Prepare account export' }),
    )

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/account/exports', {
      method: 'POST',
    })
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Your export is ready to download.',
    )
    expect(
      screen.getByRole('link', { name: 'Download account export' }),
    ).toHaveAttribute(
      'href',
      '/api/v1/account/exports/550e8400-e29b-41d4-a716-446655440000',
    )
  })

  it('shows a retryable server error', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Try again later.' }), {
        status: 500,
      }),
    )

    render(<AccountExportPanel />)
    await user.click(
      screen.getByRole('button', { name: 'Prepare account export' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Try again later.',
    )
    expect(
      screen.getByRole('button', { name: 'Prepare account export' }),
    ).toBeEnabled()
  })
})
