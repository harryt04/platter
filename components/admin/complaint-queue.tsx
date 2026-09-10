'use client'

import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  complaintNextStatuses,
  type AdminComplaintSummary,
  type ComplaintStatus,
} from '@/lib/complaints'

const statusLabels: Record<ComplaintStatus, string> = {
  received: 'Received',
  actioned: 'Actioned',
  countered: 'Countered',
  restored: 'Restored',
  closed: 'Closed',
}

const typeLabels: Record<AdminComplaintSummary['type'], string> = {
  copyright: 'Copyright concern',
  'source-removal': 'Source removal request',
  'incorrect-attribution': 'Incorrect attribution',
  other: 'Other public-content concern',
}

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString()
}

export function ComplaintQueue({
  initialComplaints,
}: {
  initialComplaints: AdminComplaintSummary[]
}) {
  const [complaints, setComplaints] =
    React.useState<AdminComplaintSummary[]>(initialComplaints)
  const [pendingId, setPendingId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function updateStatus(complaintId: string, status: ComplaintStatus) {
    setPendingId(complaintId)
    setError(null)
    try {
      const response = await fetch(`/api/v1/admin/complaints/${complaintId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const body = (await response.json()) as {
        complaint?: AdminComplaintSummary
        detail?: string
      }
      if (!response.ok || !body.complaint) {
        throw new Error(
          body.detail ?? 'The complaint status could not be updated.',
        )
      }
      setComplaints((current) =>
        current.map((complaint) =>
          complaint.id === complaintId ? body.complaint! : complaint,
        ),
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Try again.')
    } finally {
      setPendingId(null)
    }
  }

  if (complaints.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-sm">
            No public-content complaints have been received.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <p aria-live="polite" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {complaints.map((complaint) => {
        const nextStatuses = complaintNextStatuses(complaint.status)
        return (
          <Card key={complaint.id}>
            <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <CardTitle>{typeLabels[complaint.type]}</CardTitle>
                <p className="font-data text-muted-foreground text-xs break-all">
                  {complaint.id}
                </p>
              </div>
              <Badge
                variant={complaint.status === 'closed' ? 'outline' : 'warning'}
              >
                {statusLabels[complaint.status]}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground text-xs uppercase">
                    Target
                  </p>
                  <div className="mt-1 space-y-1">
                    {complaint.recipeId && (
                      <p className="font-data break-all">
                        Recipe {complaint.recipeId}
                      </p>
                    )}
                    {complaint.sourceUrl && (
                      <a
                        className="text-primary break-all underline underline-offset-4"
                        href={complaint.sourceUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {complaint.sourceUrl}
                      </a>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase">
                    Received
                  </p>
                  <p className="mt-1">
                    {formatTimestamp(complaint.receivedAt)}
                  </p>
                </div>
              </div>

              <div className="bg-muted/40 rounded-md border p-4">
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  Review description
                </p>
                <p className="mt-2 text-sm whitespace-pre-wrap">
                  {complaint.description}
                </p>
              </div>

              <div className="border-l-primary border-l-2 pl-4 text-sm">
                <p className="font-medium">Restricted reply contact</p>
                <p className="text-muted-foreground mt-1">
                  {complaint.contact?.name ?? 'No name provided'}
                  {complaint.contact?.email && ` · ${complaint.contact.email}`}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Visible only in this administrator view. Keep it out of logs
                  and public responses.
                </p>
              </div>

              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted-foreground text-xs">
                  Last updated {formatTimestamp(complaint.updatedAt)}
                </p>
                {nextStatuses.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {nextStatuses.map((nextStatus) => (
                      <Button
                        disabled={pendingId !== null}
                        key={nextStatus}
                        onClick={() => updateStatus(complaint.id, nextStatus)}
                        size="sm"
                        variant="outline"
                      >
                        Move to {statusLabels[nextStatus].toLowerCase()}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
