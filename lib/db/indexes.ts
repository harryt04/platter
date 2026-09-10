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
}
