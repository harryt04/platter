'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { createMutationMetadata } from '@/lib/contracts/mutations'
import {
  groceryCategoryDefinitions,
  type GroceryCategory,
} from '@/lib/recipes/grocery-categories'

export function GroceryCategorySelect({
  itemId,
  ingredientName,
  category,
  listId,
  baseRevision,
  editable = true,
}: {
  itemId: string
  ingredientName: string
  category: GroceryCategory
  listId: string
  baseRevision?: number
  editable?: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  async function changeCategory(nextCategory: GroceryCategory) {
    if (nextCategory === category) return
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch(
        `/api/v1/lists/${encodeURIComponent(listId)}/grocery-items/${encodeURIComponent(itemId)}/category`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            category: nextCategory,
            ...createMutationMetadata(baseRevision),
          }),
        },
      )
      const body = (await response.json()) as { detail?: string }
      if (!response.ok)
        throw new Error(body.detail ?? 'The grocery category could not change.')
      setMessage(body.detail ?? 'Category changed.')
      router.refresh()
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : 'The grocery category could not change.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label
        className="text-muted-foreground text-sm"
        htmlFor={`category-${itemId}`}
      >
        Category for {ingredientName}
      </label>
      <select
        className="border-input bg-background h-11 rounded-md border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!editable || pending}
        id={`category-${itemId}`}
        onChange={(event) =>
          void changeCategory(event.target.value as GroceryCategory)
        }
        value={category}
      >
        {Object.entries(groceryCategoryDefinitions).map(
          ([value, definition]) => (
            <option key={value} value={value}>
              {definition.label}
            </option>
          ),
        )}
      </select>
      <span
        aria-live="polite"
        className="text-muted-foreground text-xs"
        role="status"
      >
        {pending ? 'Saving category…' : message}
      </span>
      {!editable && (
        <span className="text-muted-foreground text-xs">
          This archived list is read-only.
        </span>
      )}
    </div>
  )
}
