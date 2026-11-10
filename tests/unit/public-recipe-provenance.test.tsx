import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PublicRecipeProvenance } from '@/components/recipes/public-recipe-provenance'

afterEach(() => cleanup())

describe('PublicRecipeProvenance', () => {
  it('keeps source attribution and version visible as factual metadata', () => {
    render(
      <PublicRecipeProvenance
        attribution="Adapted with permission."
        imageLicense="Licensed for reuse"
        sourceAuthor="Alex Rivera"
        sourceName="Synthetic kitchen"
        sourceUrl="https://example.com/recipe"
        versionNumber={3}
      />,
    )

    expect(
      screen.getByRole('region', { name: 'Recipe provenance' }),
    ).toHaveTextContent('Synthetic kitchen')
    expect(
      screen.getByRole('link', { name: 'Synthetic kitchen' }),
    ).toHaveAttribute('href', 'https://example.com/recipe')
    expect(
      screen.getByText('By Alex Rivera · Adapted with permission.'),
    ).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Licensed for reuse')).toBeInTheDocument()
    expect(screen.getByText('3')).toHaveClass('font-data')
  })

  it('keeps the source readable when optional attribution is absent', () => {
    render(
      <PublicRecipeProvenance
        sourceName="Platter community"
        versionNumber={1}
      />,
    )

    expect(screen.getByText('Platter community')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.queryByText('Attribution')).not.toBeInTheDocument()
    expect(screen.queryByText('Image rights')).not.toBeInTheDocument()
  })

  it('explains that unavailable sources do not remove preserved recipe facts', () => {
    render(
      <PublicRecipeProvenance
        sourceAvailability="unavailable"
        sourceName="Synthetic kitchen"
        sourceUrl="https://example.com/recipe"
        versionNumber={1}
      />,
    )

    expect(
      screen.getByText(
        'Source currently unavailable. The recipe facts and attribution are preserved.',
      ),
    ).toBeInTheDocument()
  })

  it('states unknown image rights and confirms the image is not shown publicly', () => {
    render(
      <PublicRecipeProvenance
        imageRightsStatus="unknown"
        sourceName="Imported kitchen"
        versionNumber={1}
      />,
    )

    expect(screen.getByText('Image rights')).toBeInTheDocument()
    expect(
      screen.getByText('Unknown — not displayed publicly'),
    ).toBeInTheDocument()
  })
})
