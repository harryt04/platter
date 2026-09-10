'use client'

import * as React from 'react'
import { GripVertical, ArrowDown, ArrowUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createMutationMetadata } from '@/lib/contracts/mutations'
import {
  groceryCategoryDefinitions,
  type GroceryCategory,
} from '@/lib/recipes/grocery-categories'

export function GroceryCategoryOrderSection({
  category,
  categories,
  listId,
  baseRevision,
  editable = true,
  children,
}: React.PropsWithChildren<{
  category: GroceryCategory
  categories: readonly GroceryCategory[]
  listId: string
  baseRevision?: number
  editable?: boolean
}>) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const position = categories.indexOf(category)
  const previousCategory = position > 0 ? categories[position - 1] : undefined
  const nextCategory =
    position >= 0 && position < categories.length - 1
      ? categories[position + 1]
      : undefined

  async function move(
    sourceCategory: GroceryCategory,
    targetCategory: GroceryCategory,
    placement: 'before' | 'after',
  ) {
    if (!editable || sourceCategory === targetCategory) return
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch(
        `/api/v1/lists/${encodeURIComponent(listId)}/grocery-categories/order`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            category: sourceCategory,
            targetCategory,
            placement,
            ...createMutationMetadata(baseRevision),
          }),
        },
      )
      const body = (await response.json()) as { detail?: string }
      if (!response.ok)
        throw new Error(body.detail ?? 'The grocery category could not move.')
      setMessage(body.detail ?? 'Grocery category order changed.')
      router.refresh()
    } catch (caught) {
      setMessage(
        caught instanceof Error
          ? caught.message
          : 'The grocery category could not move.',
      )
    } finally {
      setPending(false)
    }
  }

  function drop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault()
    const sourceCategory = event.dataTransfer.getData('text/platter-category')
    if (!categories.includes(sourceCategory as GroceryCategory)) return
    void move(sourceCategory as GroceryCategory, category, 'before')
  }

  const label = groceryCategoryDefinitions[category].label
  return (
    <section
      aria-labelledby={`${category}-heading`}
      draggable={editable && !pending}
      onDragOver={(event) => event.preventDefault()}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/platter-category', category)
      }}
      onDrop={drop}
    >
      <div className="mb-3 flex flex-wrap items-center gap-1">
        <GripVertical
          aria-hidden="true"
          className="text-muted-foreground"
          size={18}
        />
        <h3
          className="text-muted-foreground text-sm font-semibold"
          id={`${category}-heading`}
        >
          {label}
        </h3>
        <span className="text-muted-foreground ml-1 text-xs">
          Drag to move, or use the move buttons.
        </span>
        <Button
          aria-label={`Move ${label} category up`}
          disabled={!editable || pending || !previousCategory}
          onClick={() =>
            previousCategory && void move(category, previousCategory, 'before')
          }
          size="icon"
          type="button"
          variant="outline"
        >
          <ArrowUp aria-hidden="true" size={18} />
        </Button>
        <Button
          aria-label={`Move ${label} category down`}
          disabled={!editable || pending || !nextCategory}
          onClick={() =>
            nextCategory && void move(category, nextCategory, 'after')
          }
          size="icon"
          type="button"
          variant="outline"
        >
          <ArrowDown aria-hidden="true" size={18} />
        </Button>
        <span
          aria-live="polite"
          className="text-muted-foreground text-xs"
          role="status"
        >
          {pending ? 'Moving category…' : message}
        </span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}
