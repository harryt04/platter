'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function InvitationAcceptance({
  token,
  acceptPath,
  invitationPath,
  listName,
  email,
  isAuthenticated,
  unavailable,
}: {
  token: string
  acceptPath?: string
  invitationPath: string
  listName: string
  email: string
  isAuthenticated: boolean
  unavailable?: 'expired' | 'used-or-revoked'
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const updateConnection = () => setOffline(!navigator.onLine)
    updateConnection()
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    return () => {
      window.removeEventListener('online', updateConnection)
      window.removeEventListener('offline', updateConnection)
    }
  }, [])

  async function accept() {
    if (offline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      setError(
        'Reconnect before accepting this invitation. Invitations are not queued on this device.',
      )
      return
    }
    setBusy(true)
    setError('')
    try {
      const response = await fetch(
        acceptPath ?? `/api/v1/invitations/${encodeURIComponent(token)}`,
        { method: 'POST' },
      )
      if (!response.ok) {
        const problem = (await response.json()) as { detail?: string }
        throw new Error(problem.detail ?? 'We couldn’t accept this invitation.')
      }
      const result = (await response.json()) as {
        list: { id?: string; _id?: string }
      }
      router.push(`/lists/${result.list.id ?? result.list._id ?? ''}`)
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'We couldn’t accept this invitation.',
      )
      setBusy(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardContent className="space-y-4 p-6">
        {unavailable === 'expired' ? (
          <p role="alert">
            This invitation has expired. Ask the owner to send a new one.
          </p>
        ) : unavailable === 'used-or-revoked' ? (
          <p role="alert">This invitation has already been used or revoked.</p>
        ) : isAuthenticated ? (
          <>
            <p>
              Accept this invitation to join “{listName}” as an editor. The
              invitation is for {email}.
            </p>
            {offline && (
              <p className="text-muted-foreground text-sm" role="status">
                You’re offline. Reconnect before accepting this invitation.
                Invitations are not queued on this device.
              </p>
            )}
            <Button disabled={busy || offline} onClick={accept}>
              {busy ? 'Joining…' : `Join ${listName}`}
            </Button>
          </>
        ) : (
          <>
            <p>
              Sign in with {email} to join “{listName}”.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link
                  href={`/sign-in?returnTo=${encodeURIComponent(invitationPath)}`}
                >
                  Sign in to accept
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link
                  href={`/sign-up?returnTo=${encodeURIComponent(invitationPath)}`}
                >
                  Create an account
                </Link>
              </Button>
            </div>
          </>
        )}
        {!isAuthenticated && offline && (
          <p className="text-muted-foreground text-sm" role="status">
            You’re offline. Reconnect before signing in or accepting this
            invitation. Invitations are not queued on this device.
          </p>
        )}
        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
