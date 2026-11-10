'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { createMutationMetadata } from '@/lib/contracts/mutations'
import { Button } from '@/components/ui/button'
import { SyncStatus } from '@/components/states/sync-status'
import { browserIsOffline, queueBrowserMutation } from '@/lib/offline/mutations'

export function AlreadyHaveButton({
  itemId,
  ingredientName,
  listId,
  runId,
  userId,
  baseRevision,
  marked,
  editable = true,
}: {
  itemId: string
  ingredientName: string
  listId: string
  runId?: string
  userId?: string
  baseRevision?: number
  marked: boolean
  editable?: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [offlinePending, setOfflinePending] = React.useState(false)
  const [optimisticMarked, setOptimisticMarked] = React.useState<
    boolean | null
  >(null)
  const localMarked = optimisticMarked ?? marked

  async function changeState() {
    setPending(true)
    setMessage(null)
    setError(null)
    try {
      if (browserIsOffline()) {
        await queueBrowserMutation({
          userId,
          listId,
          runId,
          baseRevision,
          kind: localMarked
            ? 'grocery.already-have.undo'
            : 'grocery.already-have.set',
          payload: { itemId, alreadyHave: !localMarked },
        })
        setOptimisticMarked(!localMarked)
        setOfflinePending(true)
        setMessage(
          'Saved on this device. We’ll sync it when you’re back online.',
        )
        return
      }
      const response = await fetch(
        `/api/v1/lists/${encodeURIComponent(listId)}/grocery-items/${encodeURIComponent(itemId)}/already-have`,
        {
          method: localMarked ? 'DELETE' : 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(createMutationMetadata(baseRevision, runId)),
        },
      )
      const body = (await response.json()) as { detail?: string }
      if (!response.ok) {
        throw new Error(
          body.detail ?? 'The already-have state could not change.',
        )
      }
      setMessage(
        body.detail ??
          (localMarked
            ? 'Added the item back to your buy view.'
            : 'Marked already have.'),
      )
      setOfflinePending(false)
      setOptimisticMarked(!localMarked)
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The already-have state could not change.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        aria-label={
          localMarked
            ? `Undo already have for ${ingredientName}`
            : `Mark ${ingredientName} already have`
        }
        aria-pressed={localMarked}
        disabled={!editable || pending}
        onClick={changeState}
        type="button"
        variant={localMarked ? 'secondary' : 'outline'}
      >
        {pending
          ? 'Saving…'
          : localMarked
            ? 'Undo already have'
            : 'Mark already have'}
      </Button>
      {offlinePending && <SyncStatus state="pending" />}
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
