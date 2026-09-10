'use client'

import { useState } from 'react'
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

function localCalendarDate() {
  const now = new Date()
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((value, index) =>
      index === 0 ? String(value) : String(value).padStart(2, '0'),
    )
    .join('-')
}

export function CompleteShoppingRunButton({
  listId,
  listName,
  baseRevision,
  disabled = false,
}: {
  listId: string
  listName: string
  baseRevision?: number
  disabled?: boolean
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [completed, setCompleted] = useState(false)

  async function complete() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(
        `/api/v1/lists/${encodeURIComponent(listId)}/complete`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...createMutationMetadata(baseRevision),
            localDate: localCalendarDate(),
          }),
        },
      )
      if (!response.ok) {
        const problem = (await response.json()) as { detail?: string }
        throw new Error(problem.detail ?? 'We couldn’t complete this run.')
      }
      setIsOpen(false)
      setCompleted(true)
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'We couldn’t complete this run.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
      <Button
        className="w-full sm:w-auto"
        disabled={disabled || busy}
        onClick={() => setIsOpen(true)}
      >
        {disabled
          ? 'Shopping unavailable while archived'
          : 'Complete shopping run'}
      </Button>
      {completed && (
        <p className="text-success text-sm" role="status">
          Run completed. A fresh shopping run is ready.
        </p>
      )}
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
      {isOpen && (
        <AlertDialog
          aria-labelledby="complete-run-title"
          aria-describedby="complete-run-description"
          aria-modal="true"
          className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <AlertDialogContent className="w-full max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle id="complete-run-title">
                Complete “{listName}” shopping run?
              </AlertDialogTitle>
              <AlertDialogDescription id="complete-run-description">
                This closes the current shared checklist and starts one empty
                shopping run. The recipes and people counts are kept in shopping
                history; purchased and already-have states are not.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                type="button"
                disabled={busy}
                onClick={() => setIsOpen(false)}
              >
                Keep shopping
              </AlertDialogCancel>
              <AlertDialogAction
                type="button"
                disabled={busy}
                onClick={complete}
              >
                {busy ? 'Completing…' : 'Complete shopping run'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
