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
