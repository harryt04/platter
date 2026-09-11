import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

afterEach(() => cleanup())

describe('RadioGroup', () => {
  it('gives every item one native group name for keyboard navigation', async () => {
    const user = userEvent.setup()
    render(
      <RadioGroup defaultValue="system" aria-label="Theme preference">
        <RadioGroupItem id="system" value="system" />
        <RadioGroupItem id="light" value="light" />
        <RadioGroupItem id="dark" value="dark" />
      </RadioGroup>,
    )

    const radios = screen.getAllByRole('radio')
    expect(
      new Set(radios.map((radio) => radio.getAttribute('name'))).size,
    ).toBe(1)
    expect(radios[0]).toBeChecked()

    await user.click(radios[0]!)
    await user.keyboard('{ArrowDown}')
    expect(radios[1]).toBeChecked()
  })

  it('updates the selected item through the shared change handler', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <RadioGroup defaultValue="system" onValueChange={onValueChange}>
        <RadioGroupItem id="system" value="system" />
        <RadioGroupItem id="light" value="light" />
      </RadioGroup>,
    )

    const radios = screen.getAllByRole('radio')
    await user.click(radios[1]!)

    expect(onValueChange).toHaveBeenCalledWith('light')
    expect(radios[1]).toBeChecked()
    expect(radios[0]).not.toBeChecked()
  })
})
