import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/button'

describe('Button touch targets', () => {
  it('keeps compact and icon actions at least 44px high', () => {
    render(
      <>
        <Button>Default action</Button>
        <Button size="sm">Compact action</Button>
        <Button aria-label="Icon action" size="icon">
          +
        </Button>
      </>,
    )

    for (const name of ['Default action', 'Compact action', 'Icon action']) {
      expect(screen.getByRole('button', { name }).className).toContain(
        'min-h-11',
      )
    }
  })
})
