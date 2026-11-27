import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { Toaster, toast } from '@/components/ui/toast'

describe('Toaster', () => {
  afterEach(() => {
    act(() => {
      toast.dismiss()
    })
    cleanup()
  })

  it('shows queued toasts with their title, description and type', async () => {
    const { container } = render(<Toaster />)

    act(() => {
      toast.success('List saved', { description: 'Everyone can see it now.' })
    })

    const item = await within(container.ownerDocument.body).findByText(
      'List saved',
    )
    const toastElement = item.closest('[data-platter-toast]')
    expect(toastElement).not.toBeNull()
    expect(toastElement).toHaveAttribute('data-type', 'success')
    expect(toastElement).toHaveTextContent('Everyone can see it now.')
    expect(
      toastElement?.closest('[data-platter-toast-region]'),
    ).toHaveAttribute('data-agent-hidden')
  })

  it('dismisses a toast from its named close button', async () => {
    const user = userEvent.setup()
    render(<Toaster />)

    act(() => {
      toast('Copied', { duration: Infinity })
    })

    const toastElement = (await screen.findByText('Copied')).closest(
      '[data-platter-toast]',
    ) as HTMLElement
    await user.click(
      within(toastElement).getByRole('button', {
        name: 'Dismiss notification',
      }),
    )

    await expect
      .poll(() => toastElement.isConnected, { timeout: 5000 })
      .toBe(false)
  })
})
