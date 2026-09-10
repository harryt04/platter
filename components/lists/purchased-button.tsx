'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { createMutationMetadata } from '@/lib/contracts/mutations'
import { Button } from '@/components/ui/button'

export function PurchasedButton({
  itemId,
  ingredientName,
  listId,
  baseRevision,
  marked,
  editable = true,
}: {
  itemId: string
  ingredientName: string
  listId: string
  baseRevision?: number
  marked: boolean
  editable?: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function changeState() {
    setPending(true)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch(
        `/api/v1/lists/${encodeURIComponent(listId)}/grocery-items/${encodeURIComponent(itemId)}/purchased`,
        {
          method: marked ? 'DELETE' : 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(createMutationMetadata(baseRevision)),
        },
      )
      const body = (await response.json()) as { detail?: string }
      if (!response.ok) {
        throw new Error(body.detail ?? 'The purchased state could not change.')
      }
      setMessage(
        body.detail ??
          (marked ? 'Added back to your buy view.' : 'Marked purchased.'),
      )
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The purchased state could not change.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        aria-label={
          marked
            ? `Undo purchased for ${ingredientName}`
            : `Mark ${ingredientName} purchased`
        }
        aria-pressed={marked}
        disabled={!editable || pending}
        onClick={changeState}
        type="button"
        variant={marked ? 'secondary' : 'outline'}
      >
        {pending ? 'Saving…' : marked ? 'Undo purchased' : 'Mark purchased'}
      </Button>
      <span
        aria-live="polite"
        className="text-muted-foreground text-xs"
        role="status"
      >
        {error ?? message}
      </span>
      {!editable && (
        <span className="text-muted-foreground text-xs">
          This archived list is read-only.
        </span>
      )}
    </div>
  )
}
