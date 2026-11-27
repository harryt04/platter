import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Link from 'next/link'
import { lazy, Suspense } from 'react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/button'

afterEach(cleanup)

describe('Button touch targets', () => {
  it('keeps compact and icon actions at least 44px high', () => {
    render(
      <>
        <Button>Default action</Button>
        <Button size="sm">Compact action</Button>
        <Button aria-label="Icon action" size="icon">
          +
        </Button>
      </>,
    )

    for (const name of ['Default action', 'Compact action', 'Icon action']) {
      expect(screen.getByRole('button', { name }).className).toContain(
        'min-h-11',
      )
    }
  })
})

it('renders a Next link without a button type and preserves its content', () => {
  render(
    <Button asChild type="submit">
      <Link href="/discover">Discover</Link>
    </Button>,
  )
  const link = screen.getByRole('link', { name: 'Discover' })
  expect(link).toHaveAttribute('href', '/discover')
  expect(link).not.toHaveAttribute('type')
  expect(link).toHaveClass('min-h-11')
})

it('submits the form with a default Button even when it has a click handler', async () => {
  const user = userEvent.setup()
  const click = vi.fn()
  const submit = vi.fn((event: React.FormEvent<HTMLFormElement>) =>
    event.preventDefault(),
  )
  render(
    <form onSubmit={submit}>
      <Button onClick={click}>Save</Button>
    </form>,
  )
  await user.tab()
  await user.keyboard('{Enter}')
  expect(click).toHaveBeenCalledOnce()
  expect(submit).toHaveBeenCalledOnce()
})

it('passes button styling through a lazy link child', async () => {
  const LazyLink = lazy(async () => ({ default: Link }))
  render(
    <Suspense fallback={null}>
      <Button asChild>
        <LazyLink href="/discover">Discover later</LazyLink>
      </Button>
    </Suspense>,
  )
  const link = await screen.findByRole('link', { name: 'Discover later' })
  expect(link).toHaveClass('min-h-11')
  expect(link).not.toHaveAttribute('type')
})
