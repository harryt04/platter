'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createMutationMetadata } from '@/lib/contracts/mutations'

export function RepeatHistoryButton({
  listId,
  historyId,
  runId,
}: {
  listId: string
  historyId: string
  runId?: string
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function repeatRun() {
    setPending(true)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch(
        `/api/v1/lists/${encodeURIComponent(listId)}/history/${encodeURIComponent(historyId)}/repeat`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(createMutationMetadata(undefined, runId)),
        },
      )
      const body = (await response.json()) as {
        addedCount?: number
        detail?: string
      }
      if (!response.ok) {
        throw new Error(body.detail ?? 'These recipes could not be added.')
      }
      setMessage(
        body.addedCount === 1
          ? '1 recipe was added to the current shopping run.'
          : `${body.addedCount ?? 0} recipes were added to the current shopping run.`,
      )
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button disabled={pending} onClick={repeatRun} type="button">
        {pending ? 'Adding recipes…' : 'Add these recipes to this week'}
      </Button>
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {error ?? message}
      </p>
    </div>
  )
}
