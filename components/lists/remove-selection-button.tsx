'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createMutationMetadata } from '@/lib/contracts/mutations'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function RemoveSelectionButton({
  listId,
  listName,
  selectionId,
  recipeTitle,
  runId,
  baseRevision,
  editable = true,
}: {
  listId: string
  listName: string
  selectionId: string
  recipeTitle: string
  runId?: string
  baseRevision?: number
  editable?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function removeSelection() {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/v1/lists/${encodeURIComponent(listId)}/selections/${encodeURIComponent(selectionId)}`,
        {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(createMutationMetadata(baseRevision, runId)),
        },
      )
      const body = (await response.json()) as { detail?: string }
      if (!response.ok) {
        throw new Error(
          body.detail ?? 'The recipe selection could not be removed.',
        )
      }
      setOpen(false)
      router.refresh()
      document
        .getElementById(`remove-selection-trigger-${selectionId}`)
        ?.focus()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Try again.')
    } finally {
      setPending(false)
    }
  }

  if (!editable) return null

  return (
    <>
      <Button
        id={`remove-selection-trigger-${selectionId}`}
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
        type="button"
        variant="destructive"
      >
        Remove selection
      </Button>
      {open && (
        <AlertDialog
          aria-labelledby={`remove-selection-title-${selectionId}`}
          aria-describedby={`remove-selection-description-${selectionId}`}
          aria-modal="true"
          className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <AlertDialogContent className="w-full max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle id={`remove-selection-title-${selectionId}`}>
                Remove “{recipeTitle}” from {listName}?
              </AlertDialogTitle>
              <AlertDialogDescription
                id={`remove-selection-description-${selectionId}`}
              >
                This removes {recipeTitle}’s grocery contributions from the{' '}
                {listName} run. Other selected recipes and manual grocery items
                stay unchanged.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {error && (
              <p className="text-destructive mt-4 text-sm" role="alert">
                {error}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={pending}
                onClick={() => setOpen(false)}
                type="button"
              >
                Keep selection
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={pending}
                onClick={removeSelection}
                type="button"
              >
                {pending ? 'Removing…' : 'Remove selection'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}
