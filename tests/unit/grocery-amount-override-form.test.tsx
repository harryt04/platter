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
  category: 'pantry',
  normalizedIdentity: 'rice',
  dimension: 'mass',
  unit: { name: 'lb', dimension: 'mass' },
  calculatedRequirement: { min: '2' },
  shoppingAmount: { min: '2' },
  contributions: [],
}

const overriddenItem: GroceryItem = {
  ...item,
  shoppingAmount: { min: '5.25' },
  override: { min: '5.25' },
}

const suggestedItem: GroceryItem = {
  ...item,
  unit: { name: 'each', dimension: 'count' },
  calculatedRequirement: { min: '1.5' },
  shoppingAmount: { min: '1.5' },
  suggestedShoppingAmount: {
    kind: 'whole-unit',
    quantity: { min: '2' },
  },
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  refresh.mockReset()
})

describe('GroceryAmountOverrideForm', () => {
  it('lets shoppers copy whole-unit guidance into the editable amount', async () => {
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
        item={suggestedItem}
        listId="list-1"
      />,
    )

    expect(
      screen.getByText(
        'Optional guidance: 2 each to buy whole units. This is a suggestion, not a guaranteed fact.',
      ),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Use whole-unit suggestion for rice',
      }),
    )
    expect(screen.getByLabelText('Shopping amount for rice')).toHaveValue(2)
    expect(fetchMock).not.toHaveBeenCalled()
  })

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

  it('shows both amounts and resets only an existing override', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: 'Shopping amount for rice reset to calculated requirement.',
          shoppingAmount: { min: '2' },
          revision: 4,
        }),
        { status: 200 },
      ),
    )
    render(
      <GroceryAmountOverrideForm
        baseRevision={3}
        item={overriddenItem}
        listId="list-1"
      />,
    )

    expect(screen.getByDisplayValue('5.25')).toBeInTheDocument()
    expect(screen.getByText('Calculated requirement: 2 lb')).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Reset shopping amount for rice' }),
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const request = fetchMock.mock.calls[0]?.[1]
    expect(request).toMatchObject({ method: 'DELETE' })
    expect(JSON.parse(String(request?.body))).toMatchObject({
      baseRevision: 3,
    })
    expect(screen.getByDisplayValue('2')).toBeInTheDocument()
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('does not render a reset action without an override', () => {
    render(<GroceryAmountOverrideForm item={item} listId="list-1" />)

    expect(
      screen.queryByRole('button', { name: 'Reset shopping amount for rice' }),
    ).not.toBeInTheDocument()
  })
})
