import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Link from 'next/link'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Sidebar', () => {
  it('traps mobile keyboard focus and restores the trigger on dismissal', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )
    const user = userEvent.setup()

    render(
      <SidebarProvider>
        <Sidebar>
          <Link href="/lists">Home</Link>
          <button type="button">Second control</button>
        </Sidebar>
        <main>
          <SidebarTrigger />
          <input aria-label="Draft text" defaultValue="Unsaved" />
        </main>
      </SidebarProvider>,
    )

    const trigger = screen.getByRole('button', { name: 'Open navigation' })
    const draft = screen.getByRole('textbox', { name: 'Draft text' })
    await user.click(trigger)
    const firstControl = screen.getByRole('link', { name: 'Home' })
    const secondControl = screen.getByRole('button', { name: 'Second control' })
    const navigation = screen.getByRole('complementary', {
      name: 'Primary navigation',
    })
    const close = within(navigation).getByRole('button', {
      name: 'Close navigation',
    })
    const dialog = screen.getByRole('dialog', { name: 'Primary navigation' })
    expect(dialog).toHaveAttribute('data-agent-hidden')
    expect(dialog).toHaveAttribute('data-agent-secret')

    await waitFor(() => expect(firstControl).toHaveFocus())
    await user.tab()
    expect(secondControl).toHaveFocus()
    await user.tab()
    expect(close).toHaveFocus()
    await user.tab()
    expect(firstControl).toHaveFocus()
    await user.tab({ shift: true })
    expect(close).toHaveFocus()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(trigger).toHaveFocus())
    expect(
      screen.getByRole('button', { name: 'Open navigation' }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('textbox', { name: 'Draft text' })).toBe(draft)
    expect(draft).toHaveValue('Unsaved')

    await user.click(trigger)
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Primary navigation' }),
      ).getByRole('button', { name: 'Close navigation' }),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})
