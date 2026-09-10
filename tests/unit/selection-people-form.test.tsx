import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SelectionPeopleForm } from '@/components/lists/selection-people-form'

const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

describe('SelectionPeopleForm', () => {
  beforeEach(() => {
    cleanup()
    vi.restoreAllMocks()
    refresh.mockReset()
  })

  it('updates one recipe selection and reports its new scale', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          selection: { desiredPeople: 6, scaleFactor: '1.5' },
        }),
        { status: 200 },
      ),
    )

    render(
      <SelectionPeopleForm
        initialPeople={2}
        initialScaleFactor="0.5"
        listId="list-1"
        listName="Family"
        recipeId="recipe-1"
        recipeTitle="Tomato soup"
        selectionId="selection-1"
      />,
    )

    const people = screen.getByRole('spinbutton', {
      name: 'People for Tomato soup',
    })
    await user.clear(people)
    await user.type(people, '6')
    await user.click(screen.getByRole('button', { name: 'Update people' }))

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/lists/list-1/selections/selection-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ desiredPeople: 6 }),
      }),
    )
    expect(
      await screen.findByText(/now feeds 6 people \(scale 1\.5\)/),
    ).toBeInTheDocument()
  })

  it('keeps the pinned version until the member explicitly accepts an update', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          selection: { desiredPeople: 2, scaleFactor: '0.6666666666666667' },
        }),
        { status: 200 },
      ),
    )

    render(
      <SelectionPeopleForm
        initialPeople={2}
        initialScaleFactor="0.5"
        listId="list-1"
        listName="Family"
        newerVersionNumber={5}
        recipeId="recipe-1"
        recipeTitle="Tomato soup"
        selectionId="selection-1"
      />,
    )

    expect(fetch).not.toHaveBeenCalled()
    expect(
      screen.getByText(
        /current version stays pinned until you accept the update/,
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Review recipe' })).toHaveAttribute(
      'href',
      '/recipes/recipe-1',
    )

    await user.click(screen.getByRole('button', { name: 'Use version 5' }))

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/lists/list-1/selections/selection-1/update',
      { method: 'POST' },
    )
    expect(
      await screen.findByText(/now uses version 5 for this run/),
    ).toBeInTheDocument()
  })

  it('duplicates one selection only after the explicit duplicate action', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ selection: { desiredPeople: 2 } }), {
        status: 201,
      }),
    )

    render(
      <SelectionPeopleForm
        initialPeople={2}
        initialScaleFactor="0.5"
        listId="list-1"
        listName="Family"
        recipeId="recipe-1"
        recipeTitle="Tomato soup"
        selectionId="selection-1"
      />,
    )

    expect(fetch).not.toHaveBeenCalled()
    await user.click(
      screen.getByRole('button', { name: 'Duplicate selection' }),
    )

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/lists/list-1/selections/selection-1/duplicate',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(
      await screen.findByText(
        'Tomato soup was added again as a separate selection for 2 people.',
      ),
    ).toBeInTheDocument()
  })

  it('requires confirmation and names the list-wide impact before removing', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: 'The recipe selection was removed from this shopping run.',
        }),
        { status: 200 },
      ),
    )

    render(
      <SelectionPeopleForm
        initialPeople={2}
        initialScaleFactor="0.5"
        listId="list-1"
        listName="Family"
        recipeId="recipe-1"
        recipeTitle="Tomato soup"
        selectionId="selection-1"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Remove selection' }))
    expect(
      screen.getByText(
        /removes Tomato soup’s grocery contributions from the Family run/,
      ),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Remove selection',
      }),
    )

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/lists/list-1/selections/selection-1',
      { method: 'DELETE' },
    )
    expect(refresh).toHaveBeenCalled()
  })
})
