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
  await db.collection('recipes').createIndex(
    {
      title: 'text',
      'ingredients.originalText': 'text',
      'ingredients.ingredientName': 'text',
      sourceName: 'text',
      sourceAuthor: 'text',
      sourceUrl: 'text',
      cuisine: 'text',
      tags: 'text',
      dietaryLabels: 'text',
    },
    {
      name: 'recipe_public_search_text',
      weights: {
        title: 10,
        'ingredients.ingredientName': 8,
        'ingredients.originalText': 5,
        sourceName: 4,
        cuisine: 3,
        tags: 3,
        dietaryLabels: 3,
        sourceAuthor: 2,
        sourceUrl: 1,
      },
    },
  )
  await db.collection('recipes').createIndex(
    { 'importProvenance.contentFingerprint': 1 },
    {
      name: 'recipe_imported_public_fingerprint',
      unique: true,
      partialFilterExpression: {
        status: 'usable',
        visibility: 'public',
        origin: 'imported',
        importReviewStatus: 'approved',
        'importProvenance.contentFingerprint': { $exists: true },
      },
    },
  )
  await db
    .collection('recipe_versions')
    .createIndex({ recipeId: 1, versionNumber: 1 }, { unique: true })
  await db
    .collection('recipe_shares')
    .createIndex({ recipeId: 1, listId: 1 }, { unique: true })
  await db.collection('recipe_shares').createIndex({ listId: 1, recipeId: 1 })
  await db
    .collection('recipe_saves')
    .createIndex({ userId: 1, recipeId: 1 }, { unique: true })
  await db.collection('recipe_saves').createIndex({ userId: 1, createdAt: -1 })
  await db.collection('recipe_saves').createIndex({ recipeId: 1 })
  await db
    .collection('list_invitations')
    .createIndex({ tokenHash: 1 }, { unique: true })
  await db
    .collection('list_invitations')
    .createIndex({ listId: 1, status: 1, expiresAt: 1 })
  await db.collection('notifications').createIndex({ userId: 1, createdAt: -1 })
  await db
    .collection('account_exports')
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  await db.collection('complaints').createIndex({ createdAt: -1 })
  await db.collection('complaints').createIndex({ status: 1, receivedAt: -1 })
  await db.collection('complaint_access_audit').createIndex({ occurredAt: -1 })
  await db
    .collection('complaint_access_audit')
    .createIndex({ actorId: 1, occurredAt: -1 })
  await db.collection('public_content_suppressions').createIndex(
    { targetType: 1, target: 1, status: 1 },
    {
      name: 'public_content_suppressions_active_target',
      unique: true,
      partialFilterExpression: { status: 'active' },
    },
  )
  await db
    .collection('public_content_suppressions')
    .createIndex({ createdAt: -1 })
  await db
    .collection('public_content_suppression_audit')
    .createIndex({ occurredAt: -1 })
  await db
    .collection('public_content_suppression_audit')
    .createIndex({ actorId: 1, occurredAt: -1 })
  await db
    .collection('account_deletion_audit')
    .createIndex({ accountFingerprint: 1 }, { unique: true })
  await db
    .collection('account_deletion_audit')
    .createIndex({ status: 1, lastAttemptAt: -1 })
  await db
    .collection('recipe_imports')
    .createIndex({ userId: 1, submittedAt: -1, _id: -1 })
  await db.collection('recipe_imports').createIndex(
    { userId: 1, idempotencyKey: 1 },
    {
      name: 'recipe_imports_user_idempotency_key',
      unique: true,
      partialFilterExpression: { idempotencyKey: { $exists: true } },
    },
  )
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
  await db
    .collection('shopping_run_history')
    .createIndex({ listId: 1, localDate: -1, completedAt: -1 })
}
