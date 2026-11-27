import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { GroceryCategorySelect } from '@/components/lists/grocery-category-select'
import { AppearanceForm } from '@/components/settings/appearance-form'

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('next-themes', () => ({
  useTheme: () => {
    const [theme, setTheme] = useState('system')
    return { theme, setTheme, resolvedTheme: 'light' }
  },
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  refresh.mockClear()
})

it('selects the next named theme with the arrow key', async () => {
  const user = userEvent.setup()
  render(<AppearanceForm />)
  const system = screen.getByRole('radio', { name: /^System/ })
  expect(system).toBeChecked()
  await user.tab()
  expect(system).toHaveFocus()
  await user.keyboard('{ArrowDown}')
  const light = screen.getByRole('radio', { name: /^Light/ })
  expect(light).toHaveFocus()
  expect(light).toBeChecked()
  expect(system).not.toBeChecked()
})

it('submits the category value selected from the labeled grocery combobox', async () => {
  const user = userEvent.setup()
  const request = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(Response.json({ detail: 'Category changed.' }))
  render(
    <GroceryCategorySelect
      itemId="rice"
      listId="week"
      ingredientName="rice"
      category="produce"
    />,
  )
  await user.click(screen.getByRole('combobox', { name: 'Category for rice' }))
  await user.click(screen.getByRole('option', { name: /^Pantry/ }))
  expect(request).toHaveBeenCalledWith(
    '/api/v1/lists/week/grocery-items/rice/category',
    expect.objectContaining({
      method: 'PATCH',
      body: expect.stringContaining('"category":"pantry"'),
    }),
  )
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
})
