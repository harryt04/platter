import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountExportPanel } from '@/components/settings/account-export-panel'
import { formatAccountExportExpiry } from '@/lib/account'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AccountExportPanel', () => {
  it('requests an export and offers the private download link', async () => {
    const user = userEvent.setup()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          export: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            status: 'ready',
            createdAt: '2026-09-10T00:00:00.000Z',
            expiresAt,
            downloadUrl:
              '/api/v1/account/exports/550e8400-e29b-41d4-a716-446655440000',
          },
        }),
        { status: 201 },
      ),
    )

    render(<AccountExportPanel locale="de-DE" />)
    expect(screen.getByText(/available for 24 hours/i)).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Prepare account export' }),
    )

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/account/exports', {
      method: 'POST',
    })
    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('Your export is ready to download.')
    expect(status).toHaveTextContent(
      `Available until ${formatAccountExportExpiry(expiresAt, 'de-DE')}.`,
    )
    expect(
      screen.getByRole('link', { name: 'Download account export' }),
    ).toHaveAttribute(
      'href',
      '/api/v1/account/exports/550e8400-e29b-41d4-a716-446655440000',
    )
  })

  it('shows a retry action after a server error', async () => {
    const user = userEvent.setup()
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: 'Try again later.' }), {
          status: 500,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            export: {
              id: '550e8400-e29b-41d4-a716-446655440000',
              status: 'ready',
              createdAt: '2026-09-10T00:00:00.000Z',
              expiresAt,
              downloadUrl: '/api/v1/account/exports/export-1',
            },
          }),
          { status: 201 },
        ),
      )

    render(<AccountExportPanel />)
    await user.click(
      screen.getByRole('button', { name: 'Prepare account export' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Try again later.',
    )
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Your export is ready to download.',
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('explains when a previously prepared export has expired', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          export: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            status: 'ready',
            createdAt: '2026-09-08T00:00:00.000Z',
            expiresAt: '2026-09-09T00:00:00.000Z',
            downloadUrl: '/api/v1/account/exports/export-1',
          },
        }),
        { status: 201 },
      ),
    )

    render(<AccountExportPanel />)
    await user.click(
      screen.getByRole('button', { name: 'Prepare account export' }),
    )

    expect(
      await screen.findByText(
        'This export expired. Prepare a new export to download your data.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Prepare a new export' }),
    ).toBeEnabled()
  })
})
