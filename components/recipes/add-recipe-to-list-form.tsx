'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  SelectionIngredientPreview,
  type SelectionIngredientPreviewItem,
} from '@/components/recipes/selection-ingredient-preview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createMutationMetadata } from '@/lib/contracts/mutations'

type ListOption = { id: string; name: string; activeRunRevision?: number }

export function AddRecipeToListForm({
  recipeId,
  recipeTitle,
  defaultPeople,
  lists,
}: {
  recipeId: string
  recipeTitle: string
  defaultPeople: number
  lists: ListOption[]
}) {
  const router = useRouter()
  const [listId, setListId] = React.useState(lists[0]?.id ?? '')
  const [desiredPeople, setDesiredPeople] = React.useState(defaultPeople)
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [preview, setPreview] = React.useState<
    SelectionIngredientPreviewItem[] | null
  >(null)

  async function addRecipe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch(`/api/v1/lists/${listId}/selections`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recipeId,
          desiredPeople,
          ...createMutationMetadata(
            lists.find((list) => list.id === listId)?.activeRunRevision,
          ),
        }),
      })
      const body = (await response.json()) as {
        detail?: string
        selection?: { scaleFactor: string }
        calculatedIngredients?: SelectionIngredientPreviewItem[]
      }
      if (!response.ok) {
        throw new Error(body.detail ?? 'The recipe could not be added.')
      }
      const listName = lists.find((list) => list.id === listId)?.name
      setMessage(
        `Added ${recipeTitle} to ${listName ?? 'the list'} for ${desiredPeople} people (scale ${body.selection?.scaleFactor ?? '1'}).`,
      )
      setPreview(body.calculatedIngredients ?? [])
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      className="bg-muted/40 space-y-4 rounded-[var(--radius-card)] border p-4"
      onSubmit={addRecipe}
    >
      <div>
        <h2 className="text-lg font-semibold">Add to a shopping run</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Choose a list and the number of people this version should feed.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">
          List
          <select
            className="bg-background min-h-11 w-full rounded-[var(--radius-control)] border px-3 text-sm"
            disabled={pending}
            onChange={(event) => setListId(event.target.value)}
            value={listId}
          >
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          People
          <Input
            disabled={pending}
            min={1}
            onChange={(event) => setDesiredPeople(Number(event.target.value))}
            type="number"
            value={desiredPeople}
          />
        </label>
      </div>
      <Button disabled={pending || !listId || desiredPeople < 1} type="submit">
        {pending ? 'Adding to this week…' : 'Add to this week'}
      </Button>
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {error ?? message}
      </p>
      {preview && <SelectionIngredientPreview ingredients={preview} />}
    </form>
  )
}
