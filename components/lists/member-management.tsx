'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
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
import type { ListMember } from '@/lib/lists'

type Action = { type: 'remove' | 'promote'; member: ListMember } | null

export function MemberManagement({
  listId,
  listName,
  initialMembers,
}: {
  listId: string
  listName: string
  initialMembers: ListMember[]
}) {
  const router = useRouter()
  const [members, setMembers] = useState(initialMembers)
  const [action, setAction] = useState<Action>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState('')

  async function applyAction() {
    if (!action) return
    setBusy(true)
    setError('')
    setConfirmation('')
    const encodedListId = encodeURIComponent(listId)
    const encodedMemberId = encodeURIComponent(action.member.userId)
    try {
      const response = await fetch(
        `/api/v1/lists/${encodedListId}/members/${encodedMemberId}`,
        action.type === 'remove'
          ? { method: 'DELETE' }
          : {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ role: 'owner' }),
            },
      )
      const body = (await response.json()) as {
        member?: ListMember
        detail?: string
      }
      if (!response.ok) {
        throw new Error(body.detail ?? 'We couldn’t update this member.')
      }

      if (action.type === 'remove') {
        setMembers((current) =>
          current.filter((member) => member.userId !== action.member.userId),
        )
        setConfirmation(
          `${action.member.userId} no longer has access to “${listName}”.`,
        )
      } else if (body.member) {
        setMembers((current) =>
          current.map((member) =>
            member.userId === body.member!.userId ? body.member! : member,
          ),
        )
        setConfirmation(
          `${action.member.userId} is now an owner of “${listName}”.`,
        )
      }
      setAction(null)
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'We couldn’t update this member.',
      )
    } finally {
      setBusy(false)
    }
  }

  const selectedCopy = action
    ? action.type === 'remove'
      ? {
          title: `Remove ${action.member.userId} from ${listName}?`,
          description:
            'They will immediately lose access to this list and its shared shopping run. Other lists are not affected.',
          confirm: 'Remove member',
        }
      : {
          title: `Make ${action.member.userId} an owner?`,
          description:
            'They will be able to invite, manage members, and change the list settings.',
          confirm: 'Make owner',
        }
    : null

  return (
    <section aria-labelledby="active-members-heading" className="space-y-3">
      <div>
        <h2 id="active-members-heading" className="text-lg font-semibold">
          Active members
        </h2>
        <p className="text-muted-foreground text-sm">
          Owners can manage roles. Editors can use the shared shopping run.
        </p>
      </div>
      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
      {confirmation && (
        <p className="text-success text-sm" role="status">
          {confirmation}
        </p>
      )}
      <div className="space-y-3">
        {members.map((member) => (
          <div
            className="bg-card flex flex-col gap-3 rounded-[var(--radius-card)] border p-4 sm:flex-row sm:items-center sm:justify-between"
            key={member.userId}
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{member.userId}</p>
              <p className="text-muted-foreground text-sm">
                Active list member
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Badge variant={member.role === 'owner' ? 'default' : 'outline'}>
                {member.role}
              </Badge>
              {member.role === 'editor' && (
                <>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => setAction({ type: 'promote', member })}
                  >
                    Make owner
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={busy}
                    onClick={() => setAction({ type: 'remove', member })}
                  >
                    Remove
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {selectedCopy && action && (
        <AlertDialog
          aria-labelledby="member-action-title"
          aria-describedby="member-action-description"
          aria-modal="true"
          className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <AlertDialogContent className="w-full max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle id="member-action-title">
                {selectedCopy.title}
              </AlertDialogTitle>
              <AlertDialogDescription id="member-action-description">
                {selectedCopy.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                type="button"
                disabled={busy}
                onClick={() => setAction(null)}
              >
                Keep member
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
