'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function DuplicateSelectionButton({
  listId,
  selectionId,
  recipeTitle,
  desiredPeople,
  editable = true,
}: {
  listId: string
  selectionId: string
  recipeTitle: string
  desiredPeople: number
  editable?: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function duplicateSelection() {
    setPending(true)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch(
        `/api/v1/lists/${listId}/selections/${selectionId}/duplicate`,
        {
          method: 'POST',
        },
      )
      const body = (await response.json()) as {
        detail?: string
        selection?: { desiredPeople: number }
      }
      if (!response.ok || !body.selection) {
        throw new Error(
          body.detail ?? 'The recipe selection could not be duplicated.',
        )
      }
      setMessage(
        `${recipeTitle} was added again as a separate selection for ${body.selection.desiredPeople ?? desiredPeople} people.`,
      )
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Try again.')
    } finally {
      setPending(false)
    }
  }

  if (!editable) return null

  return (
    <div className="space-y-2">
      <Button
        disabled={pending}
        onClick={duplicateSelection}
        type="button"
        variant="ghost"
      >
        {pending ? 'Duplicating…' : 'Duplicate selection'}
      </Button>
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {error ?? message}
      </p>
    </div>
  )
}
