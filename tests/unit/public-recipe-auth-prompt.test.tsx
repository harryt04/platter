import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PublicRecipeAuthPrompt } from '@/components/recipes/public-recipe-auth-prompt'

afterEach(() => cleanup())

describe('PublicRecipeAuthPrompt', () => {
  it('directs anonymous readers to authenticate and preserves the recipe return path', () => {
    render(<PublicRecipeAuthPrompt recipeId="recipe-42" />)

    expect(
      screen.getByText(
        'Sign in before saving this recipe or adding it to one of your lists. You’ll return here after authentication.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Sign in to continue' }),
    ).toHaveAttribute('href', '/sign-in?returnTo=%2Frecipes%2Frecipe-42')
    expect(
      screen.getByRole('link', { name: 'Create an account' }),
    ).toHaveAttribute('href', '/sign-up?returnTo=%2Frecipes%2Frecipe-42')
  })
})
