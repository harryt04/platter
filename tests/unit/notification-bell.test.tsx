import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotificationBell } from '@/components/notifications/notification-bell'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('NotificationBell', () => {
  it('shows unread membership notifications and marks them read', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            notifications: [
              {
                id: '550e8400-e29b-41d4-a716-446655440000',
                event: 'removed',
                listId: 'list-1',
                listName: 'Family',
                createdAt: '2026-09-10T12:00:00.000Z',
                title: 'Removed from Family',
                body: 'You no longer have access to Family.',
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            notification: {
              readAt: '2026-09-10T12:01:00.000Z',
            },
          }),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(<NotificationBell />)
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: '1 unread notifications' }),
      ).toBeInTheDocument(),
    )
    await user.click(
      screen.getByRole('button', { name: '1 unread notifications' }),
    )
    expect(screen.getByText('Removed from Family')).toBeInTheDocument()
    await user.click(screen.getByText('Removed from Family'))

    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/v1/notifications/550e8400-e29b-41d4-a716-446655440000',
      { method: 'PATCH' },
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Notifications' }),
      ).toBeInTheDocument(),
    )
  })
})
