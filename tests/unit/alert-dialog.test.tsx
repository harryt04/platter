import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

afterEach(cleanup)

function Harness({ dismissible = true }: { dismissible?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <AlertDialog open={open} onOpenChange={setOpen} dismissible={dismissible}>
        <AlertDialogContent>
          <AlertDialogTitle>Confirm action</AlertDialogTitle>
          <AlertDialogDescription>
            Review this change first.
          </AlertDialogDescription>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Confirm</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

describe('AlertDialog', () => {
  it('names and describes the modal, wraps Tab, and restores focus on Escape', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open dialog' })
    await user.click(trigger)

    const dialog = screen.getByRole('alertdialog', { name: 'Confirm action' })
    expect(dialog).toHaveAccessibleDescription('Review this change first.')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('data-agent-hidden')
    expect(dialog).toHaveAttribute('data-agent-secret')
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    const confirm = screen.getByRole('button', { name: 'Confirm' })
    await waitFor(() => expect(cancel).toHaveFocus())
    await user.tab()
    expect(confirm).toHaveFocus()
    await user.tab()
    expect(cancel).toHaveFocus()
    await user.tab({ shift: true })
    expect(confirm).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('ignores an outside press even when Escape dismissal is enabled', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open dialog' }))
    const backdrop = document.querySelector<HTMLElement>(
      '[data-platter="alert-dialog-backdrop"]',
    )
    expect(backdrop).toBeInTheDocument()
    await user.click(backdrop!)
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('blocks Escape when dismissal is disabled and closes through Cancel', async () => {
    const user = userEvent.setup()
    render(<Harness dismissible={false} />)
    const trigger = screen.getByRole('button', { name: 'Open dialog' })
    await user.click(trigger)
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    await waitFor(() => expect(cancel).toHaveFocus())
    await user.keyboard('{Escape}')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    await user.click(cancel)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})
