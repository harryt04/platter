'use client'

import { SelectField } from '@/components/ui/select'
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
  runId,
  baseRevision,
  editable = true,
}: {
  itemId: string
  ingredientName: string
  category: GroceryCategory
  listId: string
  runId?: string
  baseRevision?: number
  editable?: boolean
}) {
  const router = useRouter()
  const [pendingCategory, setPendingCategory] =
    React.useState<GroceryCategory | null>(null)
  const pending = pendingCategory !== null
  const [message, setMessage] = React.useState<string | null>(null)

  async function changeCategory(nextCategory: GroceryCategory) {
    if (nextCategory === category) return
    setPendingCategory(nextCategory)
    setMessage(null)
    try {
      const response = await fetch(
        `/api/v1/lists/${encodeURIComponent(listId)}/grocery-items/${encodeURIComponent(itemId)}/category`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            category: nextCategory,
            ...createMutationMetadata(baseRevision, runId),
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
      setPendingCategory(null)
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
      <SelectField
        disabled={!editable || pending}
        id={`category-${itemId}`}
        triggerClassName="w-auto min-w-40"
        items={Object.entries(groceryCategoryDefinitions).map(
          ([value, definition]) => ({
            value,
            label: definition.label,
          }),
        )}
        onValueChange={(value) => {
          if (value !== null) void changeCategory(value as GroceryCategory)
        }}
        value={pendingCategory ?? category}
      />
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
