'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function DeleteDraftButton({
  recipeId,
  title,
}: {
  recipeId: string
  title: string
}) {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function remove() {
    setBusy(true)
    setError('')
    const response = await fetch(`/api/v1/recipes/${recipeId}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: confirmation }),
    })
    if (!response.ok) {
      const problem = (await response.json()) as { detail?: string }
      setError(problem.detail ?? 'We couldn’t delete this draft.')
      setBusy(false)
      return
    }
    setOpen(false)
    setConfirmation('')
    setBusy(false)
    router.refresh()
    document.getElementById(`delete-trigger-${recipeId}`)?.focus()
  }

  return (
    <>
      <Button
        id={`delete-trigger-${recipeId}`}
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Trash2 size={16} />
        Delete
      </Button>
      {open && (
        <AlertDialog>
          <AlertDialogContent aria-modal="true">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes your private recipe draft. It is not
                available to lists or public discovery.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="mt-5 space-y-2">
              <Label htmlFor={`delete-${recipeId}`}>
                Type the recipe title to confirm
              </Label>
              <Input
                id={`delete-${recipeId}`}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoFocus
              />
              {error && (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel
                type="button"
                onClick={() => {
                  setOpen(false)
                  setConfirmation('')
                  setError('')
                }}
              >
                Keep draft
              </AlertDialogCancel>
              <AlertDialogAction
                type="button"
                disabled={busy || confirmation !== title}
                onClick={remove}
              >
                {busy ? 'Deleting…' : 'Delete draft'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}
