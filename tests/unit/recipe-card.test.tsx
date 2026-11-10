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

  it('shows permitted imagery and source attribution', () => {
    render(
      <RecipeCard
        title="Tomato soup"
        source="Synthetic kitchen"
        sourceUrl="https://example.com/recipe"
        sourceAuthor="Alex Rivera"
        attribution="Adapted with permission."
        image={{
          url: 'https://images.example.com/soup.jpg',
          altText: 'A bowl of tomato soup',
        }}
      />,
    )

    expect(
      screen.getByRole('img', { name: 'A bowl of tomato soup' }),
    ).toHaveAttribute('src', 'https://images.example.com/soup.jpg')
    expect(
      screen.getByRole('link', { name: 'Synthetic kitchen' }),
    ).toHaveAttribute('href', 'https://example.com/recipe')
    expect(
      screen.getByText('By Alex Rivera · Adapted with permission.'),
    ).toBeInTheDocument()
  })
})
