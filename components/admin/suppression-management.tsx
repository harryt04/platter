'use client'

import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PublicContentSuppressionSummary } from '@/lib/public-content-suppressions'

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString()
}

function targetLabel(suppression: PublicContentSuppressionSummary) {
  switch (suppression.targetType) {
    case 'recipe':
      return 'Recipe'
    case 'source-url':
      return 'Source URL'
    case 'fingerprint':
      return 'Content fingerprint'
    case 'domain':
      return 'Source domain'
  }
}

type RestoreResponse = {
  suppression?: PublicContentSuppressionSummary
  detail?: string
}

export function SuppressionManagement({
  initialSuppressions,
}: {
  initialSuppressions: PublicContentSuppressionSummary[]
}) {
  const [suppressions, setSuppressions] = React.useState(initialSuppressions)
  const [pendingId, setPendingId] = React.useState<string | null>(null)
  const [messages, setMessages] = React.useState<Record<string, string>>({})

  async function restore(suppression: PublicContentSuppressionSummary) {
    if (
      suppression.status !== 'active' ||
      !window.confirm(
        `Restore ${targetLabel(suppression).toLowerCase()} “${suppression.target}”? Public content can become discoverable again if no other active suppression applies.`,
      )
    ) {
      return
    }

    setPendingId(suppression.id)
    setMessages((current) => ({ ...current, [suppression.id]: '' }))
    try {
      const response = await fetch(
        `/api/v1/admin/public-content-suppressions/${encodeURIComponent(suppression.id)}/restore`,
        { method: 'POST' },
      )
      const body = (await response.json()) as RestoreResponse
      if (!response.ok || !body.suppression) {
        throw new Error(body.detail ?? 'The suppression could not be restored.')
      }
      setSuppressions((current) =>
        current.map((candidate) =>
          candidate.id === body.suppression?.id ? body.suppression : candidate,
        ),
      )
      setMessages((current) => ({
        ...current,
        [suppression.id]:
          'Restored with an audit entry. Public content was reopened only where no other active suppression applies.',
      }))
    } catch (caught) {
      setMessages((current) => ({
        ...current,
        [suppression.id]:
          caught instanceof Error ? caught.message : 'Try again.',
      }))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section aria-labelledby="suppression-management-heading">
      <h2
        className="mb-4 text-lg font-semibold"
        id="suppression-management-heading"
      >
        Suppression records
      </h2>
      {suppressions.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-sm">
              No suppression records have been created.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {suppressions.map((suppression) => {
            const message = messages[suppression.id]
            return (
              <Card key={suppression.id}>
                <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <CardTitle>{targetLabel(suppression)}</CardTitle>
                    <p className="font-data text-muted-foreground text-xs break-all">
                      {suppression.target}
                    </p>
                  </div>
                  <Badge
                    variant={
                      suppression.status === 'active' ? 'warning' : 'success'
                    }
                  >
                    {suppression.status === 'active' ? 'Active' : 'Restored'}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <p>{suppression.reason}</p>
                  <dl className="text-muted-foreground grid gap-2 text-xs sm:grid-cols-2">
                    <div>
                      <dt className="uppercase">Suppressed</dt>
                      <dd>{formatTimestamp(suppression.createdAt)}</dd>
                    </div>
                    {suppression.restoredAt && (
                      <div>
                        <dt className="uppercase">Restored</dt>
                        <dd>{formatTimestamp(suppression.restoredAt)}</dd>
                      </div>
                    )}
                  </dl>
                  {suppression.status === 'active' && (
                    <Button
                      disabled={pendingId !== null}
                      onClick={() => void restore(suppression)}
                      type="button"
                      variant="outline"
                    >
                      {pendingId === suppression.id
                        ? 'Restoring…'
                        : 'Restore public content'}
                    </Button>
                  )}
                  {message && (
                    <p aria-live="polite" className="text-success text-sm">
                      {message}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </section>
  )
}
