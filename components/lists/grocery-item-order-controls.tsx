'use client'

import * as React from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createMutationMetadata } from '@/lib/contracts/mutations'

export function GroceryItemOrderControls({
  itemId,
  ingredientName,
  listId,
  runId,
  baseRevision,
  canMoveUp,
  canMoveDown,
  editable = true,
}: {
  itemId: string
  ingredientName: string
  listId: string
  runId?: string
  baseRevision?: number
  canMoveUp: boolean
  canMoveDown: boolean
  editable?: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  async function move(direction: 'up' | 'down') {
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch(
        `/api/v1/lists/${encodeURIComponent(listId)}/grocery-items/${encodeURIComponent(itemId)}/order`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            direction,
            ...createMutationMetadata(baseRevision, runId),
          }),
        },
      )
      const body = (await response.json()) as { detail?: string }
      if (!response.ok)
        throw new Error(body.detail ?? 'The item could not move.')
      setMessage(body.detail ?? 'Item order changed.')
      router.refresh()
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : 'The item could not move.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-muted-foreground mr-1 text-sm">
        Order {ingredientName}
      </span>
      <Button
        aria-label={`Move ${ingredientName} up`}
        disabled={!editable || pending || !canMoveUp}
        onClick={() => void move('up')}
        size="icon"
        type="button"
        variant="outline"
      >
        <ArrowUp aria-hidden="true" size={18} />
      </Button>
      <Button
        aria-label={`Move ${ingredientName} down`}
        disabled={!editable || pending || !canMoveDown}
        onClick={() => void move('down')}
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
        {pending ? 'Moving…' : message}
      </span>
    </div>
  )
}
