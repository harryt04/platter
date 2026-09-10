'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { SyncStatus } from '@/components/states/sync-status'
import type { QueuedOperation } from '@/lib/contracts/mutations'
import {
  getOfflineOperations,
  getOfflineShellSnapshot,
  getOfflineSnapshots,
  getRememberedOfflineUser,
  type RunSnapshot,
  type ShellSnapshot,
} from '@/lib/offline/database'

const operationLabels: Record<string, string> = {
  'grocery.purchased.set': 'Purchased status',
  'grocery.purchased.undo': 'Purchased status',
  'grocery.already-have.set': 'Already have status',
  'grocery.already-have.undo': 'Already have status',
  'grocery.amount-override.set': 'Shopping amount',
  'grocery.amount-override.reset': 'Shopping amount',
}

function operationLabel(operation: QueuedOperation) {
  return operationLabels[operation.kind] ?? 'Shopping change'
}

export function OfflineSnapshotView({ userId }: { userId?: string }) {
  const [snapshots, setSnapshots] = useState<RunSnapshot[]>([])
  const [shell, setShell] = useState<ShellSnapshot | undefined>()
  const [operations, setOperations] = useState<QueuedOperation[]>([])
  const [loaded, setLoaded] = useState(false)
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      await Promise.resolve()
      if (cancelled) return
      const rememberedUserId = getRememberedOfflineUser()
      const effectiveUserId = userId ?? rememberedUserId
      if (!effectiveUserId || rememberedUserId !== effectiveUserId) {
        setLoaded(true)
        return
      }
      setAvailable(true)
      try {
        const [runSnapshots, shellSnapshot, queuedOperations] =
          await Promise.all([
            getOfflineSnapshots(effectiveUserId),
            getOfflineShellSnapshot(effectiveUserId),
            getOfflineOperations(effectiveUserId),
          ])
        if (cancelled) return
        setSnapshots(runSnapshots)
        setShell(shellSnapshot)
        setOperations(queuedOperations)
      } catch {
        // Treat storage failures as an unavailable offline view.
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [userId])

  const lists = shell?.payload.lists ?? []

  return (
    <ContentContainer>
      <PageHeader
        eyebrow="Offline"
        title="Saved shopping runs"
        description="These are the latest list details saved on this device. Reconnect before making changes or loading a different account."
        action={<SyncStatus state="offline" />}
      />
      {!loaded ? (
        <Card>
          <CardContent className="text-muted-foreground p-6 text-sm">
            Loading saved shopping runs…
          </CardContent>
        </Card>
      ) : !available ? (
        <Card>
          <CardContent className="text-muted-foreground p-6 text-sm">
            Offline shopping data is available only to the account that saved
            it. Sign in again with that account while connected to refresh this
            view.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {lists.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Available lists</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {lists.map((list) => (
                  <Badge key={list.id} variant="outline">
                    {list.name}
                    {list.status === 'archived' ? ' · Archived' : ''}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}
          {snapshots.length > 0 ? (
            snapshots.map((snapshot) => {
              const payload = snapshot.payload
              return (
                <Card key={snapshot.listId}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle>{payload.listName}</CardTitle>
                      <Badge variant="outline">
                        {payload.listStatus === 'archived'
                          ? 'Archived'
                          : 'Active run'}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      Run revision {payload.revision} ·{' '}
                      {payload.groceryItemCount}{' '}
                      {payload.groceryItemCount === 1
                        ? 'grocery item'
                        : 'grocery items'}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <h3 className="mb-2 text-sm font-medium">
                      Selected recipes
                    </h3>
                    {payload.recipeSelections.length > 0 ? (
                      <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
                        {payload.recipeSelections.map((selection) => (
                          <li key={selection.id}>
                            {selection.title} · {selection.desiredPeople}{' '}
                            {selection.desiredPeople === 1
                              ? 'person'
                              : 'people'}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        No recipes selected in this run.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })
          ) : (
            <Card>
              <CardContent className="text-muted-foreground p-6 text-sm">
                No shopping run has been saved on this device yet. Reconnect and
                open a list once to make it available offline.
              </CardContent>
            </Card>
          )}
          {operations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Offline changes</CardTitle>
                <p className="text-muted-foreground text-sm">
                  Changes are scoped to this account and device until they are
                  synchronized.
                </p>
              </CardHeader>
              <CardContent>
                <ul aria-label="Offline operations" className="space-y-3">
                  {operations.map((operation) => (
                    <li
                      className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                      key={operation.operationId}
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {operationLabel(operation)}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Attempt {operation.attemptCount}
                        </p>
                      </div>
                      <SyncStatus state={operation.status} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </ContentContainer>
  )
}
