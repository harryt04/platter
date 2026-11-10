import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OfflineBanner } from '@/components/states/offline-banner'

describe('OfflineBanner', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    })
  })

  it('announces the offline state and removes it after reconnecting', () => {
    render(<OfflineBanner />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    })
    fireEvent(window, new Event('offline'))

    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent(
      'Offline. Changes stay on this device until you reconnect.',
    )

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    })
    fireEvent(window, new Event('online'))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
