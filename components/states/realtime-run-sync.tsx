'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { io } from 'socket.io-client'
import { clientEnv } from '@/lib/env/client'
import { realtimeRunMutationEventSchema } from '@/lib/contracts/mutations'

type ConnectionState =
  'connecting' | 'connected' | 'disconnected' | 'unavailable'

function connectionCopy(state: ConnectionState) {
  switch (state) {
    case 'connected':
      return 'Live updates on'
    case 'disconnected':
      return 'Live updates paused; reconnecting'
    case 'unavailable':
      return 'Live updates unavailable; changes still save normally'
    default:
      return 'Connecting to live updates'
  }
}

/** Keep the server-rendered active run fresh for other connected shoppers. */
export function RealtimeRunSync({
  listId,
  runId,
  revision,
}: {
  listId: string
  runId: string
  revision: number
}) {
  const router = useRouter()
  const latestRevision = useRef(revision)
  const [state, setState] = useState<ConnectionState>('connecting')

  useEffect(() => {
    latestRevision.current = revision
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

      latestRevision.current = event.revision
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
    }
  }, [listId, router, runId])

  return (
    <p
      aria-live="polite"
      className="text-muted-foreground text-xs"
      role="status"
    >
      {connectionCopy(state)}
    </p>
  )
}
