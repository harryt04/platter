'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DuplicateSelectionButton } from '@/components/lists/duplicate-selection-button'
import { RemoveSelectionButton } from '@/components/lists/remove-selection-button'

export function SelectionPeopleForm({
  listId,
  listName,
  selectionId,
  recipeTitle,
  initialPeople,
  initialScaleFactor,
  editable = true,
}: {
  listId: string
  listName: string
  selectionId: string
  recipeTitle: string
  initialPeople: number
  initialScaleFactor: string
  editable?: boolean
}) {
  const [desiredPeople, setDesiredPeople] = React.useState(initialPeople)
  const [scaleFactor, setScaleFactor] = React.useState(initialScaleFactor)
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function updatePeople(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch(
        `/api/v1/lists/${listId}/selections/${selectionId}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ desiredPeople }),
        },
      )
      const body = (await response.json()) as {
        detail?: string
        selection?: { desiredPeople: number; scaleFactor: string }
      }
      if (!response.ok || !body.selection) {
        throw new Error(body.detail ?? 'The recipe selection could not change.')
      }
      setDesiredPeople(body.selection.desiredPeople)
      setScaleFactor(body.selection.scaleFactor)
      setMessage(
        `${recipeTitle} now feeds ${body.selection.desiredPeople} people (scale ${body.selection.scaleFactor}).`,
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      className="space-y-3 rounded-[var(--radius-control)] border p-3"
      onSubmit={updatePeople}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{recipeTitle}</p>
          <p className="text-muted-foreground text-xs">
            Scale <span className="font-data">{scaleFactor}</span>
          </p>
        </div>
        <label className="text-muted-foreground flex min-h-11 items-center gap-2 text-sm">
          People
          <Input
            aria-label={`People for ${recipeTitle}`}
            className="w-20"
            disabled={pending || !editable}
            min={1}
            onChange={(event) => setDesiredPeople(Number(event.target.value))}
            type="number"
            value={desiredPeople}
          />
        </label>
      </div>
      {editable ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={pending || desiredPeople < 1}
            type="submit"
            variant="outline"
          >
            {pending ? 'Updating…' : 'Update people'}
          </Button>
          <DuplicateSelectionButton
            desiredPeople={desiredPeople}
            listId={listId}
            recipeTitle={recipeTitle}
            selectionId={selectionId}
          />
          <RemoveSelectionButton
            listId={listId}
            listName={listName}
            recipeTitle={recipeTitle}
            selectionId={selectionId}
          />
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          This selection is read-only while the list is archived.
        </p>
      )}
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {error ?? message}
      </p>
    </form>
  )
}
