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

export function AccountDeletionPanel({
  email,
  userId,
}: {
  email: string
  userId: string
}) {
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
      await clearOfflineSession(userId).catch(() => undefined)
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
          Approved public imports remain available with their source attribution
          and rights information, without your account attached. Completed-run
          history keeps only an unavailable recipe reference. Review the impact
          above first.
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
      <AlertDialog
        open={open}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        dismissible={!busy}
      >
        <AlertDialogContent
          className="max-w-md"
          initialFocus={() => document.getElementById('delete-account-email')}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your Platter account?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Your private authored recipes and account
              data will be removed. Approved public imports remain available
              with their source attribution and rights information, without your
              account attached. Existing list history keeps only a minimal
              unavailable recipe reference.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delete-account-email">
                Type {email} to confirm
              </Label>
              <Input
                id="delete-account-email"
                value={confirmation}
                onValueChange={setConfirmation}
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
                onValueChange={setPassword}
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
            <AlertDialogCancel disabled={busy}>Keep account</AlertDialogCancel>
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
    </section>
  )
}
