import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CompleteShoppingRunButton } from '@/components/lists/complete-shopping-run-button'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('CompleteShoppingRunButton', () => {
  it('names the shared impact and refreshes after completion', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ completed: true })))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(
      <CompleteShoppingRunButton
        baseRevision={4}
        listId="list-1"
        listName="Family"
      />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Complete shopping run' }),
    )
    expect(
      screen.getByText(
        /starts one empty shopping run.*purchased and already-have states are not/i,
      ),
    ).toBeInTheDocument()
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Complete shopping run',
      }),
    )

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/lists/list-1/complete',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: expect.stringContaining('"baseRevision":4'),
      }),
    )
    expect(refresh).toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Run completed. A fresh shopping run is ready.',
    )
  })

  it('keeps archived completion unavailable', () => {
    render(
      <CompleteShoppingRunButton disabled listId="list-1" listName="Family" />,
    )

    expect(
      screen.getByRole('button', {
        name: 'Shopping unavailable while archived',
      }),
    ).toBeDisabled()
  })
})
