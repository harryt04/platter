import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Loading from '@/app/(browse)/recipes/[recipeId]/loading'

describe('public recipe loading state', () => {
  it('preserves a labeled recipe-detail skeleton while content loads', () => {
    render(<Loading />)

    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
    expect(
      screen.getByLabelText('Loading').querySelectorAll('div'),
    ).not.toHaveLength(0)
  })
})
