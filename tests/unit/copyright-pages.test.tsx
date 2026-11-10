import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CopyrightPage from '@/app/(browse)/copyright/page'
import CopyrightReportPage from '@/app/(browse)/copyright/report/page'
import { resetServerEnvForTests } from '@/lib/env/server'

describe('public copyright pages', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    resetServerEnvForTests()
  })

  it('explains the removal path and privacy boundary', () => {
    render(<CopyrightPage />)

    expect(
      screen.getByRole('heading', { name: 'Copyright and removal' }),
    ).toBeInTheDocument()
    expect(screen.getByText('How to request removal')).toBeInTheDocument()
    expect(
      screen.getByText(/has not configured optional designated-agent/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/not shown on public recipe pages/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/each hosted operator must configure and publish/i),
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('link', { name: /report a concern/i })[0],
    ).toHaveAttribute('href', '/copyright/report')
  })

  it('publishes configured designated-agent and notice process links', () => {
    vi.stubEnv('PUBLIC_CATALOG_DMCA_AGENT_NAME', 'Platter Rights Agent')
    vi.stubEnv('PUBLIC_CATALOG_DMCA_AGENT_CONTACT', 'rights@example.test')
    vi.stubEnv(
      'PUBLIC_CATALOG_DMCA_NOTICE_URL',
      'https://platter.example/dmca/notice',
    )
    vi.stubEnv(
      'PUBLIC_CATALOG_DMCA_COUNTER_NOTICE_URL',
      'https://platter.example/dmca/counter-notice',
    )
    resetServerEnvForTests()

    render(<CopyrightPage />)

    expect(
      screen.getByText(/Platter Rights Agent · rights@example.test/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Notice process' }),
    ).toHaveAttribute('href', 'https://platter.example/dmca/notice')
    expect(
      screen.getByRole('link', { name: 'Counter-notice process' }),
    ).toHaveAttribute('href', 'https://platter.example/dmca/counter-notice')
  })

  it('sets expectations for the future complaint intake', async () => {
    render(await CopyrightReportPage({}))

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
