'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function InvitationAcceptance({
  token,
  invitationPath,
  listName,
  email,
  isAuthenticated,
  unavailable,
}: {
  token: string
  invitationPath: string
  listName: string
  email: string
  isAuthenticated: boolean
  unavailable?: 'expired' | 'used-or-revoked'
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function accept() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(
        `/api/v1/invitations/${encodeURIComponent(token)}`,
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
            <Button disabled={busy} onClick={accept}>
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
        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
