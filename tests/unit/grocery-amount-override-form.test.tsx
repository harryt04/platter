import {
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GroceryAmountOverrideForm } from '@/components/lists/grocery-amount-override-form'
import type { GroceryItem } from '@/lib/recipes/groceries'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const item: GroceryItem = {
  id: 'grocery:merged:rice:mass:lb',
  ingredientName: 'rice',
  normalizedIdentity: 'rice',
  dimension: 'mass',
  unit: { name: 'lb', dimension: 'mass' },
  calculatedRequirement: { min: '2' },
  shoppingAmount: { min: '2' },
  contributions: [],
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  refresh.mockReset()
})

describe('GroceryAmountOverrideForm', () => {
  it('submits a precise shopping amount without changing the displayed calculation', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ detail: 'Shopping amount for rice updated.' }),
          { status: 200 },
        ),
      )
    render(
      <GroceryAmountOverrideForm
        baseRevision={3}
        item={item}
        listId="list-1"
      />,
    )

    fireEvent.change(screen.getByLabelText('Shopping amount for rice'), {
      target: { value: '5.25' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Set shopping amount' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const request = fetchMock.mock.calls[0]?.[1]
    expect(request).toMatchObject({ method: 'PATCH' })
    expect(JSON.parse(String(request?.body))).toMatchObject({
      quantity: { min: '5.25' },
      baseRevision: 3,
    })
    expect(screen.getByText('Calculated requirement: 2 lb')).toBeInTheDocument()
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('disables the mutation for an archived run', () => {
    render(
      <GroceryAmountOverrideForm
        editable={false}
        item={item}
        listId="list-1"
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Set shopping amount' }),
    ).toBeDisabled()
    expect(screen.getByText(/archived list is read-only/i)).toBeInTheDocument()
  })
})
