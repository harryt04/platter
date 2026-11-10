'use client'

import { useEffect } from 'react'
import {
  saveRunSnapshot,
  saveShellSnapshot,
  type OfflineRunSnapshotPayload,
  type OfflineShellSnapshotPayload,
} from '@/lib/offline/database'

export function OfflineShellSnapshotWriter({
  userId,
  payload,
  updatedAt,
}: {
  userId: string
  payload: OfflineShellSnapshotPayload
  updatedAt: string
}) {
  useEffect(() => {
    void saveShellSnapshot(userId, { payload, updatedAt }).catch(
      () => undefined,
    )
  }, [payload, updatedAt, userId])
  return null
}

export function OfflineRunSnapshotWriter({
  userId,
  payload,
  updatedAt,
}: {
  userId: string
  payload: OfflineRunSnapshotPayload
  updatedAt: string
}) {
  useEffect(() => {
    void saveRunSnapshot(userId, {
      listId: payload.listId,
      runId: payload.runId,
      revision: payload.revision,
      payload,
      updatedAt,
    }).catch(() => undefined)
  }, [payload, updatedAt, userId])
  return null
}
