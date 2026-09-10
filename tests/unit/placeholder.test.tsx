import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from '@/components/states/empty-state'

describe('EmptyState', () => {
  it('names the next useful action', () => {
    render(
      <EmptyState
        title="Your list is empty"
        description="Choose a recipe."
        action="Discover recipes"
        href="/discover"
      />,
    )
    expect(
      screen.getByRole('heading', { name: 'Your list is empty' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Discover recipes' }),
    ).toHaveAttribute('href', '/discover')
  })
})
