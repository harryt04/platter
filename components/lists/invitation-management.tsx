'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import type { InvitationSummary } from '@/lib/invitations'

function invitationDate(expiresAt: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    new Date(expiresAt),
  )
}

export function InvitationManagement({
  listId,
  listName,
  initialInvitations,
}: {
  listId: string
  listName: string
  initialInvitations: InvitationSummary[]
}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [invitations, setInvitations] = useState(initialInvitations)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState('')

  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setConfirmation('')
    try {
      const response = await fetch(
        `/api/v1/lists/${encodeURIComponent(listId)}/invitations`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email }),
        },
      )
      const body = (await response.json()) as {
        invitation?: InvitationSummary
        detail?: string
      }
      if (!response.ok || !body.invitation) {
        throw new Error(body.detail ?? 'We couldn’t create the invitation.')
      }
      setInvitations((current) => [body.invitation!, ...current])
      setEmail('')
      setConfirmation(
        `Invitation created for ${body.invitation.email}. Share the link below.`,
      )
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'We couldn’t create the invitation.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function resend(invitationId: string) {
    setBusyId(invitationId)
    setError('')
    setConfirmation('')
    try {
      const response = await fetch(
        `/api/v1/lists/${encodeURIComponent(listId)}/invitations/${encodeURIComponent(invitationId)}`,
        { method: 'POST' },
      )
      const body = (await response.json()) as {
        invitation?: InvitationSummary
        detail?: string
      }
      if (!response.ok || !body.invitation) {
        throw new Error(body.detail ?? 'We couldn’t resend the invitation.')
      }
      setInvitations((current) =>
        current.map((item) =>
          item.id === invitationId ? { ...item, ...body.invitation } : item,
        ),
      )
      setConfirmation(`Invitation resent to ${body.invitation.email}.`)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'We couldn’t resend the invitation.',
      )
    } finally {
      setBusyId(null)
    }
  }

  async function revoke() {
    if (!selectedId) return
    const invitationId = selectedId
    setBusyId(invitationId)
    setError('')
    setConfirmation('')
    try {
      const response = await fetch(
        `/api/v1/lists/${encodeURIComponent(listId)}/invitations/${encodeURIComponent(invitationId)}`,
        { method: 'DELETE' },
      )
      const body = (await response.json()) as {
        invitation?: InvitationSummary
        detail?: string
      }
      if (!response.ok || !body.invitation) {
        throw new Error(body.detail ?? 'We couldn’t revoke the invitation.')
      }
      setInvitations((current) =>
        current.map((item) =>
          item.id === invitationId ? { ...item, ...body.invitation } : item,
        ),
      )
      setSelectedId(null)
      setConfirmation(`Invitation to ${body.invitation.email} was revoked.`)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'We couldn’t revoke the invitation.',
      )
    } finally {
      setBusyId(null)
    }
  }

  const selectedInvitation = invitations.find((item) => item.id === selectedId)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Invite someone to {listName}</CardTitle>
          <CardDescription>
            Invitations are private to this list and expire automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={invite}>
            <div className="space-y-2">
              <Label htmlFor="invitation-email">Email address</Label>
              <Input
                id="invitation-email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="friend@example.com"
                maxLength={320}
                required
              />
            </div>
            <Button disabled={busy} type="submit">
              {busy ? 'Creating…' : `Invite to ${listName}`}
            </Button>
          </form>
        </CardContent>
      </Card>

      {(error || confirmation) && (
        <p
          className={
            error ? 'text-destructive text-sm' : 'text-success text-sm'
          }
          role={error ? 'alert' : 'status'}
        >
          {error || confirmation}
        </p>
      )}

      <section aria-labelledby="invitations-heading" className="space-y-3">
        <h2 id="invitations-heading" className="text-lg font-semibold">
          Invitations
        </h2>
        {invitations.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No invitations have been created for this list.
          </p>
        ) : (
          invitations.map((invitation) => (
            <Card key={invitation.id}>
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-medium">{invitation.email}</p>
                  <p className="text-muted-foreground text-sm">
                    {invitation.status === 'pending'
                      ? `Expires ${invitationDate(invitation.expiresAt)}`
                      : `Invitation ${invitation.status}`}
                  </p>
                  {invitation.inviteUrl && (
                    <a
                      className="text-primary block truncate text-sm underline underline-offset-4"
                      href={invitation.inviteUrl}
                    >
                      {invitation.inviteUrl}
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      invitation.status === 'pending' ? 'warning' : 'outline'
                    }
                  >
                    {invitation.status}
                  </Badge>
                  {invitation.status === 'pending' && (
                    <>
                      <Button
                        variant="outline"
                        disabled={busyId !== null}
                        onClick={() => resend(invitation.id)}
                      >
                        {busyId === invitation.id ? 'Resending…' : 'Resend'}
                      </Button>
                      <Button
                        variant="destructive"
                        disabled={busyId !== null}
                        onClick={() => setSelectedId(invitation.id)}
                      >
                        Revoke
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {selectedInvitation && (
        <AlertDialog
          aria-labelledby="revoke-invitation-title"
          aria-describedby="revoke-invitation-description"
          aria-modal="true"
          className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <AlertDialogContent className="w-full max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle id="revoke-invitation-title">
                Revoke invitation to {selectedInvitation.email}?
              </AlertDialogTitle>
              <AlertDialogDescription id="revoke-invitation-description">
                This invitation link will stop working. The person will not be
                added to “{listName}”.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                type="button"
                disabled={busyId !== null}
                onClick={() => setSelectedId(null)}
              >
                Keep invitation
              </AlertDialogCancel>
              <AlertDialogAction
                type="button"
                disabled={busyId !== null}
                onClick={revoke}
              >
                {busyId === selectedInvitation.id
                  ? 'Revoking…'
                  : 'Revoke invitation'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
