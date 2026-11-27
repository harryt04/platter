import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountProfileForm } from '@/components/settings/account-profile-form'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AccountProfileForm', () => {
  it('renders profile fields and saves the server-normalized response', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          account: {
            id: 'user-1',
            name: 'Jamie Lee',
            email: 'jamie@example.test',
            locale: 'de-DE',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )

    const { container } = render(
      <AccountProfileForm
        email="jamie@example.test"
        initialLocale="en-US"
        initialName="Jamie"
      />,
    )

    expect(screen.getByLabelText('Email address')).toHaveValue(
      'jamie@example.test',
    )
    expect(screen.getByLabelText('Display name')).toHaveValue('Jamie')
    expect(screen.getByRole('combobox', { name: 'Locale' })).toHaveTextContent(
      'English (United States)',
    )

    await user.clear(screen.getByLabelText('Display name'))
    await user.type(screen.getByLabelText('Display name'), 'Jamie Lee')
    await user.click(screen.getByRole('combobox', { name: 'Locale' }))
    await user.click(
      screen.getByRole('option', { name: 'Deutsch (Deutschland)' }),
    )
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/v1/account',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Jamie Lee', locale: 'de-DE' }),
      }),
    )
    expect(await within(container).findByRole('status')).toHaveTextContent(
      'Your profile was saved.',
    )
    expect(refresh).toHaveBeenCalled()
  })

  it('shows a server validation error', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Choose a supported locale.' }), {
        status: 422,
        headers: { 'content-type': 'application/json' },
      }),
    )

    render(
      <AccountProfileForm
        email="jamie@example.test"
        initialLocale="en-US"
        initialName="Jamie"
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a supported locale.',
    )
  })
})
