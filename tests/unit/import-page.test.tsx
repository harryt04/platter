import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ImportPage from '@/app/(app)/import/page'

describe('ImportPage', () => {
  it('explains that URL imports require connectivity', () => {
    render(<ImportPage />)

    expect(
      screen.getByText(
        /URL imports require internet access and are not queued offline/i,
      ),
    ).toBeInTheDocument()
  })
})
