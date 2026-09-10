import type { Db } from 'mongodb'

export async function ensureSharedIndexes(db: Db) {
  await db
    .collection('migration_ledger')
    .createIndex({ name: 1 }, { unique: true })
  await db
    .collection('realtime_events')
    .createIndex({ createdAt: 1 }, { expireAfterSeconds: 86_400 })
  await db.collection('realtime_events').createIndex({ listId: 1, revision: 1 })
  await db.collection('recipes').createIndex({ ownerId: 1, updatedAt: -1 })
  await db
    .collection('list_invitations')
    .createIndex({ tokenHash: 1 }, { unique: true })
  await db
    .collection('list_invitations')
    .createIndex({ listId: 1, status: 1, expiresAt: 1 })
  await db.collection('notifications').createIndex({ userId: 1, createdAt: -1 })
  await db.collection('lists').createIndex({
    'members.userId': 1,
    'members.invitationState': 1,
  })
  await db
    .collection('shopping_runs')
    .createIndex(
      { listId: 1, state: 1 },
      { unique: true, partialFilterExpression: { state: 'active' } },
    )
}
