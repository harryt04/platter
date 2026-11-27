import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, expect, it } from 'vitest'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectField } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

afterEach(cleanup)

it('submits an externally labeled checkbox checked with Space', async () => {
  const user = userEvent.setup()
  const { container } = render(
    <form>
      <label htmlFor="optional">Optional ingredient</label>
      <Checkbox id="optional" name="optional" value="yes" />
    </form>,
  )
  const form = container.querySelector('form')!
  const checkbox = screen.getByRole('checkbox', { name: 'Optional ingredient' })
  expect(new FormData(form).has('optional')).toBe(false)
  await user.tab()
  expect(checkbox).toHaveFocus()
  await user.keyboard(' ')
  expect(checkbox).toBeChecked()
  expect(new FormData(form).get('optional')).toBe('yes')
})

it('dismisses a private select with Escape and returns focus without selecting', async () => {
  const user = userEvent.setup()
  const { container } = render(
    <form>
      <label htmlFor="list">List</label>
      <SelectField
        id="list"
        name="list"
        defaultValue="first"
        items={[
          { value: 'first', label: 'First list' },
          { value: 'second', label: 'Second list' },
        ]}
      />
    </form>,
  )
  const trigger = screen.getByRole('combobox', { name: 'List' })
  await user.tab()
  expect(trigger).toHaveFocus()
  await user.keyboard('{Enter}')
  const listbox = await screen.findByRole('listbox')
  const privacyBoundary = listbox.closest(
    '[data-agent-hidden][data-agent-secret]',
  )
  expect(privacyBoundary).toBeInTheDocument()
  expect(container).not.toContainElement(listbox)
  await user.keyboard('{ArrowDown}{Escape}')
  await waitFor(() => expect(trigger).toHaveFocus())
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  const form = container.querySelector('form')!
  expect(new FormData(form).get('list')).toBe('first')
  await user.keyboard('{Enter}{ArrowDown}{Enter}')
  await waitFor(() => expect(new FormData(form).get('list')).toBe('second'))
})

it('keeps controlled textarea edits and form values in sync and secret', async () => {
  function Form() {
    const [value, setValue] = useState('')
    return (
      <form>
        <Textarea
          aria-label="Notes"
          name="notes"
          value={value}
          onValueChange={setValue}
        />
        <output>{value}</output>
      </form>
    )
  }

  const user = userEvent.setup()
  const { container } = render(<Form />)
  const textarea = screen.getByRole('textbox', { name: 'Notes' })
  await user.type(textarea, 'Quiet note')
  expect(textarea).toHaveAttribute('data-agent-secret')
  expect(screen.getByRole('status')).toHaveTextContent('Quiet note')
  expect(new FormData(container.querySelector('form')!).get('notes')).toBe(
    'Quiet note',
  )
})
