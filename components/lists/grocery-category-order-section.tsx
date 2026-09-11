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
  runId,
  baseRevision,
  editable = true,
  children,
}: React.PropsWithChildren<{
  category: GroceryCategory
  categories: readonly GroceryCategory[]
  listId: string
  runId?: string
  baseRevision?: number
  editable?: boolean
}>) {
  const router = useRouter()
  const upButtonRef = React.useRef<HTMLButtonElement>(null)
  const downButtonRef = React.useRef<HTMLButtonElement>(null)
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [focusTarget, setFocusTarget] = React.useState<'up' | 'down' | null>(
    null,
  )
  const position = categories.indexOf(category)
  const previousCategory = position > 0 ? categories[position - 1] : undefined
  const nextCategory =
    position >= 0 && position < categories.length - 1
      ? categories[position + 1]
      : undefined

  React.useEffect(() => {
    if (pending || !focusTarget) return

    const target =
      focusTarget === 'up' ? upButtonRef.current : downButtonRef.current
    if (!target || target.disabled) return
    target?.focus()
    setFocusTarget(null)
  }, [focusTarget, nextCategory, pending, previousCategory, position])

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
            ...createMutationMetadata(baseRevision, runId),
          }),
        },
      )
      const body = (await response.json()) as { detail?: string }
      if (!response.ok)
        throw new Error(body.detail ?? 'The grocery category could not move.')
      setMessage(body.detail ?? 'Grocery category order changed.')
      setFocusTarget(placement === 'before' ? 'down' : 'up')
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
          ref={upButtonRef}
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
          ref={downButtonRef}
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
      <div
        aria-label={`${label} grocery items`}
        className="space-y-3"
        role="list"
      >
        {children}
      </div>
    </section>
  )
}
