'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ContentContainer, PageHeader } from '@/components/shell/page-header'
import { SyncStatus } from '@/components/states/sync-status'
import {
  getOfflineShellSnapshot,
  getOfflineSnapshots,
  getRememberedOfflineUser,
  type RunSnapshot,
  type ShellSnapshot,
} from '@/lib/offline/database'

export function OfflineSnapshotView() {
  const [snapshots, setSnapshots] = useState<RunSnapshot[]>([])
  const [shell, setShell] = useState<ShellSnapshot | undefined>()
  const [loaded, setLoaded] = useState(true)

  useEffect(() => {
    const userId = getRememberedOfflineUser()
    if (!userId) return
    void Promise.all([
      getOfflineSnapshots(userId),
      getOfflineShellSnapshot(userId),
    ])
      .then(([runSnapshots, shellSnapshot]) => {
        setSnapshots(runSnapshots)
        setShell(shellSnapshot)
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true))
  }, [])

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
      ) : snapshots.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-6 text-sm">
            No shopping run has been saved on this device yet. Reconnect and
            open a list once to make it available offline.
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
          {snapshots.map((snapshot) => {
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
                    Run revision {payload.revision} · {payload.groceryItemCount}{' '}
                    {payload.groceryItemCount === 1
                      ? 'grocery item'
                      : 'grocery items'}
                  </p>
                </CardHeader>
                <CardContent>
                  <h3 className="mb-2 text-sm font-medium">Selected recipes</h3>
                  {payload.recipeSelections.length > 0 ? (
                    <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
                      {payload.recipeSelections.map((selection) => (
                        <li key={selection.id}>
                          {selection.title} · {selection.desiredPeople}{' '}
                          {selection.desiredPeople === 1 ? 'person' : 'people'}
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
          })}
        </div>
      )}
    </ContentContainer>
  )
}
