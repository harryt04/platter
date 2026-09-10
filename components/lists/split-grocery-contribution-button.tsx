'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { createMutationMetadata } from '@/lib/contracts/mutations'
import { Button } from '@/components/ui/button'
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

export function SplitGroceryContributionButton({
  itemId,
  contributionId,
  contributionLabel,
  ingredientName,
  listId,
  baseRevision,
  editable = true,
}: {
  itemId: string
  contributionId: string
  contributionLabel: string
  ingredientName: string
  listId: string
  baseRevision?: number
  editable?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function split() {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/v1/lists/${encodeURIComponent(listId)}/grocery-items/${encodeURIComponent(itemId)}/split`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contributionId,
            ...createMutationMetadata(baseRevision),
          }),
        },
      )
      const body = (await response.json()) as { detail?: string }
      if (!response.ok) {
        throw new Error(body.detail ?? 'The grocery merge could not change.')
      }
      setOpen(false)
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The grocery merge could not change.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button
        aria-label={`Split ${contributionLabel} into separate grocery item`}
        disabled={!editable || pending}
        id={`split-grocery-trigger-${contributionId}`}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        Split into separate item
      </Button>
      {error && (
        <p aria-live="polite" className="text-destructive text-xs">
          {error}
        </p>
      )}
      {open && (
        <AlertDialog
          aria-labelledby={`split-grocery-title-${contributionId}`}
          aria-describedby={`split-grocery-description-${contributionId}`}
          aria-modal="true"
          className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <AlertDialogContent className="w-full max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle id={`split-grocery-title-${contributionId}`}>
                Split this contribution?
              </AlertDialogTitle>
              <AlertDialogDescription
                id={`split-grocery-description-${contributionId}`}
              >
                {contributionLabel} will become a separate {ingredientName} item
                in the shared shopping run. The source recipe and its
                contribution facts stay unchanged.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={pending}
                onClick={() => {
                  setOpen(false)
                  document
                    .getElementById(`split-grocery-trigger-${contributionId}`)
                    ?.focus()
                }}
                type="button"
              >
                Keep combined
              </AlertDialogCancel>
              <AlertDialogAction disabled={pending} onClick={split}>
                {pending ? 'Splitting…' : 'Split item'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}
