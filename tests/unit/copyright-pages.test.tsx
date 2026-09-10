import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CopyrightPage from '@/app/(browse)/copyright/page'
import CopyrightReportPage from '@/app/(browse)/copyright/report/page'

describe('public copyright pages', () => {
  it('explains the removal path and privacy boundary', () => {
    render(<CopyrightPage />)

    expect(
      screen.getByRole('heading', { name: 'Copyright and removal' }),
    ).toBeInTheDocument()
    expect(screen.getByText('How to request removal')).toBeInTheDocument()
    expect(
      screen.getByText(/not shown on public recipe pages/i),
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('link', { name: /report a concern/i })[0],
    ).toHaveAttribute('href', '/copyright/report')
  })

  it('sets expectations for the future complaint intake', () => {
    render(<CopyrightReportPage />)

    expect(
      screen.getByRole('heading', { name: 'Report a copyright concern' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Include these details')).toBeInTheDocument()
    expect(
      screen.getByText(/restricted from public recipe responses/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Review the removal policy' }),
    ).toHaveAttribute('href', '/copyright')
  })
})
