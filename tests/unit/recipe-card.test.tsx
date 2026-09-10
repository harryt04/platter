import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RecipeCard } from '@/components/patterns/recipe-card'

afterEach(() => cleanup())

describe('RecipeCard', () => {
  it('renders recipe text as text rather than interpreting markup', () => {
    const title = '<img src=x onerror=alert(1)>'

    render(<RecipeCard title={title} />)

    expect(screen.getByText(title)).toBeInTheDocument()
    expect(document.querySelector('img')).not.toBeInTheDocument()
  })
})
