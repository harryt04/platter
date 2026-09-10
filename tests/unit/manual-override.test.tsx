import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ManualOverride } from '@/components/patterns/manual-override'

afterEach(() => {
  cleanup()
})

describe('ManualOverride', () => {
  it('disables the reset operation for a read-only shopping run', () => {
    render(<ManualOverride disabled />)

    expect(
      screen.getByRole('button', { name: 'Reset to calculated amount' }),
    ).toBeDisabled()
  })

  it('keeps the reset operation available for an active shopping run', () => {
    render(<ManualOverride />)

    expect(
      screen.getByRole('button', { name: 'Reset to calculated amount' }),
    ).toBeEnabled()
  })
})
