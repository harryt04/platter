'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { io } from 'socket.io-client'
import { clientEnv } from '@/lib/env/client'
import {
  realtimeRunMutationEventSchema,
  type RealtimeRunMutationEvent,
} from '@/lib/contracts/mutations'

type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'unavailable'
  | 'syncing'
  | 'recovering'

function connectionCopy(state: ConnectionState) {
  switch (state) {
    case 'connected':
      return 'Live updates on'
    case 'disconnected':
      return 'Live updates paused; reconnecting'
    case 'unavailable':
      return 'Live updates unavailable; changes still save normally'
    case 'syncing':
      return 'Updating from another device'
    case 'recovering':
      return 'Catching up with live updates'
    default:
      return 'Connecting to live updates'
  }
}

const remoteChangeLabels: Record<RealtimeRunMutationEvent['type'], string> = {
  'grocery.purchased.marked': 'Purchased status',
  'grocery.purchased.undone': 'Purchased status',
  'grocery.already-have.marked': 'Already have status',
  'grocery.already-have.undone': 'Already have status',
  'grocery.amount-override.set': 'shopping amount',
  'grocery.amount-override.reset': 'shopping amount',
  'grocery.manual-item.added': 'grocery item',
  'grocery.manual-item.updated': 'grocery item',
  'grocery.manual-item.removed': 'grocery item',
  'grocery.category.changed': 'grocery category',
  'grocery.item.moved': 'grocery item order',
  'grocery.category.moved': 'grocery category order',
  'grocery.merge-split': 'grocery merge',
  'recipe.selection.added': 'recipe selection',
  'recipe.selection.people-changed': 'recipe selection',
  'recipe.selection.removed': 'recipe selection',
  'recipe.selection.duplicated': 'recipe selection',
  'recipe.selection.repinned': 'recipe selection',
}

function formatRemoteChangeAnnouncement(
  changeTypes: RealtimeRunMutationEvent['type'][],
) {
  const counts = new Map<string, number>()
  for (const type of changeTypes) {
    const label = remoteChangeLabels[type]
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  const details = [...counts].map(([label, count]) =>
    count === 1 ? label : `${label} (${count})`,
  )
  const detailText =
    details.length < 2
      ? details[0]
      : details.length === 2
        ? details.join(' and ')
        : `${details.slice(0, -1).join(', ')}, and ${details.at(-1)}`
  const noun = changeTypes.length === 1 ? 'change' : 'changes'
  return `Another shopper made ${changeTypes.length} shared ${noun}: ${detailText}.`
}

/** Keep the server-rendered active run fresh for other connected shoppers. */
export function RealtimeRunSync({
  listId,
  runId,
  revision,
  currentUserId,
}: {
  listId: string
  runId: string
  revision: number
  currentUserId: string
}) {
  const router = useRouter()
  const latestRevision = useRef(revision)
  const refreshPending = useRef(false)
  const pendingRemoteChanges = useRef<RealtimeRunMutationEvent['type'][]>([])
  const announcementTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const announcementId = useRef(0)
  const [state, setState] = useState<ConnectionState>('connecting')
  const [announcement, setAnnouncement] = useState<{
    id: number
    message: string
  } | null>(null)

  useEffect(() => {
    latestRevision.current = revision
    if (refreshPending.current) {
      refreshPending.current = false
      setState('connected')
    }
  }, [listId, revision, runId])

  useEffect(() => {
    const socket = io(clientEnv.NEXT_PUBLIC_REALTIME_URL, {
      withCredentials: true,
    })

    const handleConnect = () => {
      setState('connected')
      socket.emit('foundation:join', listId)
    }
    const handleDisconnect = () => setState('disconnected')
    const handleConnectError = () => setState('unavailable')
    const handleFoundationError = () => setState('unavailable')
    const handleMutation = (payload: unknown) => {
      const parsed = realtimeRunMutationEventSchema.safeParse(payload)
      if (!parsed.success) return
      const event = parsed.data
      if (event.listId !== listId || event.runId !== runId) return
      if (event.revision <= latestRevision.current) return

      if (event.actorId !== currentUserId) {
        pendingRemoteChanges.current.push(event.type)
        if (announcementTimer.current === null) {
          announcementTimer.current = setTimeout(() => {
            announcementTimer.current = null
            const changeTypes = pendingRemoteChanges.current.splice(0)
            if (changeTypes.length === 0) return
            announcementId.current += 1
            setAnnouncement({
              id: announcementId.current,
              message: formatRemoteChangeAnnouncement(changeTypes),
            })
          }, 600)
        }
      }

      const hasRevisionGap = event.revision > latestRevision.current + 1
      latestRevision.current = event.revision
      if (refreshPending.current) return

      // Events are content-free invalidation hints. A gap means the client
      // may have missed one or more hints, so the server-rendered snapshot is
      // the recovery mechanism instead of applying event payloads locally.
      refreshPending.current = true
      setState(hasRevisionGap ? 'recovering' : 'syncing')
      router.refresh()
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)
    socket.on('foundation:error', handleFoundationError)
    socket.on('run:mutation', handleMutation)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
      socket.off('foundation:error', handleFoundationError)
      socket.off('run:mutation', handleMutation)
      socket.disconnect()
      if (announcementTimer.current !== null) {
        clearTimeout(announcementTimer.current)
        announcementTimer.current = null
      }
      pendingRemoteChanges.current = []
    }
  }, [currentUserId, listId, router, runId])

  return (
    <>
      <p
        aria-live="polite"
        className="text-muted-foreground text-xs"
        role="status"
      >
        {connectionCopy(state)}
      </p>
      <p
        aria-atomic="true"
        aria-live="polite"
        className="sr-only"
        key={announcement?.id ?? 'empty'}
      >
        {announcement?.message ?? ''}
      </p>
    </>
  )
}
