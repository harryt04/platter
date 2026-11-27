import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

afterEach(() => cleanup())

describe('RadioGroup', () => {
  it('uses one form field and selects the focused item with arrow keys', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <form>
        <RadioGroup
          defaultValue="system"
          name="theme"
          aria-label="Theme preference"
        >
          <RadioGroupItem id="system" value="system" />
          <RadioGroupItem id="light" value="light" />
          <RadioGroupItem id="dark" value="dark" />
        </RadioGroup>
      </form>,
    )

    const radios = screen.getAllByRole('radio')
    const form = container.querySelector('form')!
    expect(new FormData(form).getAll('theme')).toEqual(['system'])
    expect(radios[0]).toBeChecked()

    await user.click(radios[0]!)
    await user.keyboard('{ArrowDown}')
    expect(radios[1]).toBeChecked()
    expect(radios[1]).toHaveFocus()
    expect(new FormData(form).getAll('theme')).toEqual(['light'])
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
