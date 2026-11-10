import { cleanup, render, screen } from '@testing-library/react'
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
        <SidebarTrigger />
      </SidebarProvider>,
    )

    const trigger = screen.getByRole('button', { name: 'Open navigation' })
    await user.click(trigger)
    const firstControl = screen.getByRole('link', { name: 'Home' })
    const lastControl = screen.getByRole('button', { name: 'Second control' })

    expect(firstControl).toHaveFocus()
    await user.tab()
    expect(lastControl).toHaveFocus()
    await user.tab()
    expect(firstControl).toHaveFocus()
    await user.tab({ shift: true })
    expect(lastControl).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(
      screen.getByRole('button', { name: 'Open navigation' }),
    ).toHaveFocus()
    expect(
      screen.getByRole('button', { name: 'Open navigation' }),
    ).toHaveAttribute('aria-expanded', 'false')
  })
})
