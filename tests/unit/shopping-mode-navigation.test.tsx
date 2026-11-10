import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ShoppingModeNavigation } from '@/components/lists/shopping-mode-navigation'

afterEach(() => cleanup())

describe('ShoppingModeNavigation', () => {
  it('keeps the review action available from shopping with a touch-safe narrow layout', () => {
    render(<ShoppingModeNavigation listId="list-1" mode="shopping" />)

    const navigation = screen.getByRole('navigation', {
      name: 'Shopping run views',
    })
    const reviewLink = screen.getByRole('link', { name: 'Review at home' })

    expect(reviewLink).toHaveAttribute('href', '/lists/list-1/review')
    expect(reviewLink.className).toContain('min-h-11')
    expect(navigation.className).toContain('w-full')
    expect(navigation.className).toContain('flex-col')
  })

  it('offers the shopping action from review', () => {
    render(<ShoppingModeNavigation listId="list-1" mode="review" />)

    expect(
      screen.getByRole('link', { name: 'Start shopping' }),
    ).toHaveAttribute('href', '/lists/list-1/shop')
  })
})
