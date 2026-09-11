'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { clearOfflineSession } from '@/lib/offline/database'
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

export function AccountDeletionPanel({ email }: { email: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  function close() {
    if (busy) return
    setOpen(false)
    setConfirmation('')
    setPassword('')
    setError('')
  }

  async function deleteAccount() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/v1/account/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: confirmation, password }),
      })
      const result = (await response.json().catch(() => ({}))) as {
        detail?: string
      }
      if (!response.ok) {
        throw new Error(result.detail ?? 'We couldn’t delete your account.')
      }
      await clearOfflineSession().catch(() => undefined)
      router.push('/sign-in?deleted=1')
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'We couldn’t delete your account.',
      )
      setBusy(false)
    }
  }

  return (
    <section className="border-destructive/40 max-w-2xl rounded-[var(--radius-card)] border p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Delete account</h2>
        <p className="text-muted-foreground text-sm">
          This permanently removes your account and private authored recipes.
          Completed-run history keeps only an unavailable recipe reference.
          Review the impact above first.
        </p>
      </div>
      <Button
        className="mt-4"
        id="delete-account-trigger"
        variant="destructive"
        onClick={() => {
          setError('')
          setOpen(true)
        }}
      >
        Delete account
      </Button>
      {open && (
        <AlertDialog
          aria-labelledby="delete-account-title"
          aria-describedby="delete-account-description"
          aria-modal="true"
          className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <AlertDialogContent className="w-full max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle id="delete-account-title">
                Delete your Platter account?
              </AlertDialogTitle>
              <AlertDialogDescription id="delete-account-description">
                This cannot be undone. Your private authored recipes and account
                data will be removed. Existing list history keeps only a minimal
                unavailable recipe reference.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="delete-account-email">
                  Type {email} to confirm
                </Label>
                <Input
                  autoFocus
                  id="delete-account-email"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delete-account-password">
                  Enter your password
                </Label>
                <Input
                  id="delete-account-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel type="button" onClick={close}>
                Keep account
              </AlertDialogCancel>
              <AlertDialogAction
                type="button"
                disabled={
                  busy ||
                  confirmation.toLowerCase() !== email.toLowerCase() ||
                  !password
                }
                onClick={deleteAccount}
              >
                {busy ? 'Deleting…' : 'Delete permanently'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </section>
  )
}
