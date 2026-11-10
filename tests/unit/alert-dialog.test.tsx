import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

afterEach(cleanup)

describe('AlertDialog', () => {
  it('moves focus into the dialog, traps tab navigation, and restores the trigger', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Open dialog</button>
          {open && (
            <AlertDialog aria-label="Confirm action">
              <AlertDialogCancel onClick={() => setOpen(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction>Confirm</AlertDialogAction>
            </AlertDialog>
          )}
        </>
      )
    }

    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open dialog' })
    await user.click(trigger)

    expect(
      screen.getByRole('alertdialog', { name: 'Confirm action' }),
    ).toBeInTheDocument()
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    const confirm = screen.getByRole('button', { name: 'Confirm' })
    expect(cancel).toHaveFocus()
    await user.tab()
    expect(confirm).toHaveFocus()
    await user.tab()
    expect(cancel).toHaveFocus()
    await user.tab({ shift: true })
    expect(confirm).toHaveFocus()

    await user.click(cancel)
    expect(trigger).toHaveFocus()
  })
})
