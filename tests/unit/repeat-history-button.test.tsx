import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RepeatHistoryButton } from '@/components/lists/repeat-history-button'

const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('RepeatHistoryButton', () => {
  it('requires an explicit action and refreshes after repeating a history entry', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ addedCount: 2 }), { status: 200 }),
      )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(
      <RepeatHistoryButton
        historyId="history-1"
        listId="list-1"
        runId="run-current"
      />,
    )
    expect(fetchMock).not.toHaveBeenCalled()

    await user.click(
      screen.getByRole('button', { name: 'Add these recipes to this week' }),
    )

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/lists/list-1/history/history-1/repeat',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('operationId'),
      }),
    )
    expect(
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
    ).toMatchObject({
      runId: 'run-current',
    })
    expect(refresh).toHaveBeenCalled()
    expect(
      await screen.findByText(
        '2 recipes were added to the current shopping run.',
      ),
    ).toBeInTheDocument()
  })
})
