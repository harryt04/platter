import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ListLifecycleActions } from '@/components/lists/list-lifecycle-actions'

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('ListLifecycleActions', () => {
  it('explains archive impact and refreshes after confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ list: { status: 'archived' } }), {
        status: 200,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(
      <ListLifecycleActions
        listId="list-1"
        listName="Family"
        status="active"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Archive list' }))
    expect(
      screen.getByText(/shared shopping run will no longer accept changes/),
    ).toBeInTheDocument()
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Archive list',
      }),
    )

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/lists/list-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    })
    expect(refresh).toHaveBeenCalled()
  })

  it('reenables a later lifecycle action after an archive succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ list: { status: 'archived' } }), {
        status: 200,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    const view = render(
      <ListLifecycleActions
        listId="list-1"
        listName="Family"
        status="active"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Archive list' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Archive list',
      }),
    )

    view.rerender(
      <ListLifecycleActions
        listId="list-1"
        listName="Family"
        status="archived"
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Unarchive list' }))

    expect(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Unarchive list',
      }),
    ).toBeEnabled()
  })

  it('names the shared impact before deleting and redirects afterward', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()

    render(
      <ListLifecycleActions
        listId="list-1"
        listName="Family"
        status="archived"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Delete list' }))
    expect(
      screen.getByText(
        /removes the shared list and shopping run from everyone/,
      ),
    ).toBeInTheDocument()
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Delete list',
      }),
    )

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/lists/list-1', {
      method: 'DELETE',
    })
    expect(push).toHaveBeenCalledWith('/lists')
  })
})
