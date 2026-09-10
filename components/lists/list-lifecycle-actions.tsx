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

type LifecycleAction = 'archive' | 'unarchive' | 'delete'

const actionCopy: Record<
  LifecycleAction,
  { title: string; description: string; confirm: string }
> = {
  archive: {
    title: 'Archive list',
    description:
      'Members will keep access to this list, but its shared shopping run will no longer accept changes.',
    confirm: 'Archive list',
  },
  unarchive: {
    title: 'Unarchive list',
    description:
      'Members will be able to make changes to this list and its shared shopping run again.',
    confirm: 'Unarchive list',
  },
  delete: {
    title: 'Delete list',
    description:
      'This removes the shared list and shopping run from everyone’s lists. Completed-run history remains available.',
    confirm: 'Delete list',
  },
}

export function ListLifecycleActions({
  listId,
  listName,
  status,
}: {
  listId: string
  listName: string
  status: 'active' | 'archived'
}) {
  const router = useRouter()
  const [action, setAction] = useState<LifecycleAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const selectedCopy = action ? actionCopy[action] : null

  async function applyAction() {
    if (!action) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(
        `/api/v1/lists/${encodeURIComponent(listId)}`,
        action === 'delete'
          ? { method: 'DELETE' }
          : {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                status: action === 'archive' ? 'archived' : 'active',
              }),
            },
      )
      if (!response.ok) {
        const problem = (await response.json()) as { detail?: string }
        throw new Error(problem.detail ?? 'We couldn’t update this list.')
      }
      if (action === 'delete') {
        router.push('/lists')
      } else {
        setAction(null)
        router.refresh()
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'We couldn’t update this list.',
      )
      setBusy(false)
    }
  }

  return (
    <section className="border-destructive/40 rounded-[var(--radius-card)] border p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">List lifecycle</h2>
        <p className="text-muted-foreground text-sm">
          Only owners can change whether “{listName}” is available to the group.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() =>
            setAction(status === 'active' ? 'archive' : 'unarchive')
          }
        >
          {status === 'active' ? 'Archive list' : 'Unarchive list'}
        </Button>
        <Button variant="destructive" onClick={() => setAction('delete')}>
          Delete list
        </Button>
      </div>
      {error && (
        <p className="text-destructive mt-3 text-sm" role="alert">
          {error}
        </p>
      )}
      {selectedCopy && (
        <AlertDialog
          aria-labelledby="list-lifecycle-title"
          aria-describedby="list-lifecycle-description"
          aria-modal="true"
          className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <AlertDialogContent className="w-full max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle id="list-lifecycle-title">
                {selectedCopy.title} “{listName}”?
              </AlertDialogTitle>
              <AlertDialogDescription id="list-lifecycle-description">
                {selectedCopy.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                type="button"
                disabled={busy}
                onClick={() => setAction(null)}
              >
                Keep list
              </AlertDialogCancel>
              <AlertDialogAction
                type="button"
                disabled={busy}
                onClick={applyAction}
              >
                {busy ? `${selectedCopy.confirm}…` : selectedCopy.confirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </section>
  )
}
