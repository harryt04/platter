'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DuplicateSelectionButton } from '@/components/lists/duplicate-selection-button'
import { RemoveSelectionButton } from '@/components/lists/remove-selection-button'
import { createMutationMetadata } from '@/lib/contracts/mutations'

export function SelectionPeopleForm({
  listId,
  listName,
  recipeId,
  selectionId,
  runId,
  recipeTitle,
  initialPeople,
  initialScaleFactor,
  baseRevision,
  newerVersionNumber,
  editable = true,
}: {
  listId: string
  listName: string
  recipeId: string
  selectionId: string
  runId?: string
  recipeTitle: string
  initialPeople: number
  initialScaleFactor: string
  baseRevision?: number
  newerVersionNumber?: number
  editable?: boolean
}) {
  const router = useRouter()
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
          body: JSON.stringify({
            desiredPeople,
            ...createMutationMetadata(baseRevision, runId),
          }),
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

  async function acceptRecipeUpdate() {
    setPending(true)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch(
        `/api/v1/lists/${listId}/selections/${selectionId}/update`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(createMutationMetadata(baseRevision, runId)),
        },
      )
      const body = (await response.json()) as {
        detail?: string
        selection?: { desiredPeople: number; scaleFactor: string }
      }
      if (!response.ok || !body.selection) {
        throw new Error(body.detail ?? 'The recipe update could not be used.')
      }
      setDesiredPeople(body.selection.desiredPeople)
      setScaleFactor(body.selection.scaleFactor)
      setMessage(
        `${recipeTitle} now uses version ${newerVersionNumber ?? 'the latest'} for this run.`,
      )
      router.refresh()
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
      {newerVersionNumber && (
        <div className="border-warning/40 bg-warning/10 space-y-2 rounded-[var(--radius-control)] border p-3 text-sm">
          <p>
            A newer version of this recipe is available. Review it before
            changing this selection; the current version stays pinned until you
            accept the update.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/recipes/${recipeId}`}>Review recipe</Link>
            </Button>
            {editable && (
              <Button
                disabled={pending}
                onClick={acceptRecipeUpdate}
                size="sm"
                type="button"
              >
                {pending
                  ? 'Using update…'
                  : `Use version ${newerVersionNumber}`}
              </Button>
            )}
          </div>
        </div>
      )}
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
            runId={runId}
            baseRevision={baseRevision}
          />
          <RemoveSelectionButton
            listId={listId}
            listName={listName}
            recipeTitle={recipeTitle}
            selectionId={selectionId}
            baseRevision={baseRevision}
            runId={runId}
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
