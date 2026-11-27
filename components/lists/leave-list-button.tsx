'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

export function LeaveListButton({
  listId,
  listName,
  canLeave = true,
}: {
  listId: string
  listName: string
  canLeave?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function leave() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(
        `/api/v1/lists/${encodeURIComponent(listId)}/leave`,
        { method: 'POST' },
      )
      if (!response.ok) {
        const problem = (await response.json()) as { detail?: string }
        throw new Error(problem.detail ?? 'We couldn’t leave this list.')
      }
      router.push('/lists')
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'We couldn’t leave this list.',
      )
      setBusy(false)
    }
  }

  return (
    <section className="border-destructive/40 rounded-[var(--radius-card)] border p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Leave this list</h2>
        {canLeave ? (
          <p className="text-muted-foreground text-sm">
            You will lose access to “{listName}” and its shared shopping run.
          </p>
        ) : (
          <p className="text-warning text-sm">
            Transfer ownership to another member before leaving “{listName}”.
          </p>
        )}
      </div>
      {canLeave && (
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => {
            setError('')
            setOpen(true)
          }}
        >
          Leave this list
        </Button>
      )}
      {!open && error && (
        <p className="text-destructive mt-3 text-sm" role="alert">
          {error}
        </p>
      )}
      <AlertDialog open={open} onOpenChange={setOpen} dismissible={!busy}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave “{listName}”?</AlertDialogTitle>
            <AlertDialogDescription>
              You will lose access to this list and its shared shopping run.
              Your other lists will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p className="text-destructive mt-4 text-sm" role="alert">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep list</AlertDialogCancel>
            <AlertDialogAction type="button" disabled={busy} onClick={leave}>
              {busy ? 'Leaving…' : 'Leave list'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
