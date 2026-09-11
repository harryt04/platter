import { createHash } from 'node:crypto'
import type { Db, Filter } from 'mongodb'
import { z } from 'zod'
import { entityId, isoDateTime, type EntityId } from '@/lib/contracts/ids'
import {
  listIdSchema,
  listMembershipFilter,
  type ListDocument,
} from '@/lib/lists'
import type {
  RecipeDraftDocument,
  RecipeVersionDocument,
} from '@/lib/recipes/drafts'

/** Stable non-user owner used for detached historical recipe snapshots. */
export const deletedAccountOwnerId = 'deleted-account'

const privateRecipeFilter: Filter<RecipeDraftDocument> = {
  $and: [
    {
      $or: [{ origin: 'authored' }, { origin: { $exists: false } }],
    },
    {
      $or: [{ visibility: 'private' }, { visibility: { $exists: false } }],
    },
  ],
}

const historicalVersionUnset = {
  description: '',
  typicalPeopleFed: '',
  prepTimeMinutes: '',
  cookingTimeMinutes: '',
  totalTimeMinutes: '',
  cuisine: '',
  mealType: '',
  householdNotes: '',
  sourceName: '',
  sourceUrl: '',
  sourceAuthor: '',
  attribution: '',
  tags: '',
  dietaryLabels: '',
  image: '',
  nutrition: '',
  importProvenance: '',
  derivedFrom: '',
  ingredients: '',
  instructions: '',
} as const

export type AccountDeletionOwnershipBlocker = {
  listId: EntityId
  listName: string
  activeMemberCount: number
}

const deletionCountSchema = z.number().int().nonnegative()

export const accountDeletionOwnershipBlockerSchema = z.strictObject({
  listId: listIdSchema,
  listName: z.string().max(100),
  activeMemberCount: deletionCountSchema,
})

export const accountDeletionImpactResponseSchema = z.strictObject({
  impact: z.strictObject({
    ownedLists: deletionCountSchema,
    soleOwnerLists: z.array(z.string().max(100)),
    soleOwnerListDetails: z.array(accountDeletionOwnershipBlockerSchema),
    memberships: deletionCountSchema,
    manuallyAuthoredRecipes: deletionCountSchema,
    publicImportedRecipes: deletionCountSchema,
    completedShoppingRuns: deletionCountSchema,
  }),
})

export const accountDeletionReadinessResponseSchema = z.strictObject({
  readiness: z.strictObject({
    canDelete: z.boolean(),
    ownershipBlockers: z.array(accountDeletionOwnershipBlockerSchema),
  }),
})

export type AccountDeletionImpact = {
  ownedLists: number
  soleOwnerLists: string[]
  soleOwnerListDetails: AccountDeletionOwnershipBlocker[]
  memberships: number
  manuallyAuthoredRecipes: number
  publicImportedRecipes: number
  completedShoppingRuns: number
}

export type AccountDeletionCleanupResult = {
  deletedPrivateRecipes: number
  anonymizedHistoricalVersions: number
  deletedUnreferencedVersions: number
}

export type PublicImportDeletionResult = {
  anonymizedPublicRecipes: number
  anonymizedPublicVersions: number
}

export type AccountDeletionAuditStatus = 'prepared' | 'completed'

/**
 * Metadata-only deletion audit. The account fingerprint is deterministic so
 * retries update one record, but the deleted account's email, name, and raw
 * identifier never remain in the audit collection.
 */
export type AccountDeletionAuditDocument = {
  _id: string
  accountFingerprint: string
  status: AccountDeletionAuditStatus
  requestedAt: string
  lastAttemptAt: string
  completedAt?: string
  ownedLists: number
  coOwnedLists: number
  memberships: number
  manuallyAuthoredRecipes: number
  publicImportedRecipes: number
  completedShoppingRuns: number
  deletedPrivateRecipes: number
  anonymizedHistoricalVersions: number
  deletedUnreferencedVersions: number
  anonymizedPublicRecipes: number
  anonymizedPublicVersions: number
}

type RecipeReference = Pick<
  RecipeVersionDocument,
  '_id' | 'recipeId' | 'versionNumber'
>

function accountDeletionFingerprint(userId: string) {
  return createHash('sha256')
    .update(`platter-account-deletion:${userId}`)
    .digest('hex')
}

export type AccountDeletionAuditInput = Pick<
  AccountDeletionAuditDocument,
  | 'ownedLists'
  | 'coOwnedLists'
  | 'memberships'
  | 'manuallyAuthoredRecipes'
  | 'publicImportedRecipes'
  | 'completedShoppingRuns'
  | 'deletedPrivateRecipes'
  | 'anonymizedHistoricalVersions'
  | 'deletedUnreferencedVersions'
  | 'anonymizedPublicRecipes'
  | 'anonymizedPublicVersions'
>

/**
 * Record application-side deletion work with one retry-stable record.
 * `$setOnInsert` intentionally leaves a completed status intact if a caller
 * retries the pre-delete hook after the account has already been removed.
 */
export async function recordAccountDeletionPreparedAudit(
  db: Db,
  userId: string,
  input: AccountDeletionAuditInput,
  now = new Date(),
) {
  const fingerprint = accountDeletionFingerprint(userId)
  const timestamp = isoDateTime(now)
  await db
    .collection<AccountDeletionAuditDocument>('account_deletion_audit')
    .updateOne(
      { _id: fingerprint },
      {
        $set: {
          lastAttemptAt: timestamp,
        },
        $setOnInsert: {
          accountFingerprint: fingerprint,
          status: 'prepared',
          requestedAt: timestamp,
          ...input,
        },
      },
      { upsert: true },
    )
  return fingerprint
}

/** Mark the retry-stable audit record complete after auth and cleanup finish. */
export async function completeAccountDeletionAudit(
  db: Db,
  userId: string,
  now = new Date(),
) {
  const fingerprint = accountDeletionFingerprint(userId)
  const timestamp = isoDateTime(now)
  await db
    .collection<AccountDeletionAuditDocument>('account_deletion_audit')
    .updateOne(
      { _id: fingerprint },
      {
        $set: {
          accountFingerprint: fingerprint,
          status: 'completed',
          completedAt: timestamp,
          lastAttemptAt: timestamp,
        },
        $setOnInsert: { requestedAt: timestamp },
      },
      { upsert: true },
    )
  return fingerprint
}

function collectVersionReferences(
  records: Array<{ recipeSelections?: Array<RecipeReference> }>,
  recipeIds: Set<string>,
) {
  const references = new Set<string>()
  for (const record of records) {
    for (const selection of record.recipeSelections ?? []) {
      if (recipeIds.has(selection.recipeId)) references.add(selection._id)
    }
  }
  return references
}

/**
 * Apply the account-deletion policy to manually authored private recipes.
 * Unreferenced recipe and version documents are removed. A version referenced
 * by an active or completed run is retained only as an anonymous, non-usable
 * identity snapshot so historical resolution does not silently point at a
 * different recipe.
 */
export async function deletePrivateAccountContent(
  db: Db,
  userId: string,
): Promise<AccountDeletionCleanupResult> {
  const recipes = db.collection<RecipeDraftDocument>('recipes')
  const privateRecipes = await recipes
    .find({ ownerId: userId, ...privateRecipeFilter })
    .project({ _id: 1 })
    .toArray()
  const recipeIds = privateRecipes.map(({ _id }) => _id)
  if (recipeIds.length === 0) {
    return {
      deletedPrivateRecipes: 0,
      anonymizedHistoricalVersions: 0,
      deletedUnreferencedVersions: 0,
    }
  }

  const [activeRuns, histories, versions] = await Promise.all([
    db
      .collection<{ recipeSelections?: Array<RecipeReference> }>(
        'shopping_runs',
      )
      .find({ 'recipeSelections.recipeId': { $in: recipeIds } })
      .project({ recipeSelections: 1 })
      .toArray(),
    db
      .collection<{ recipeSelections?: Array<RecipeReference> }>(
        'shopping_run_history',
      )
      .find({ 'recipeSelections.recipeId': { $in: recipeIds } })
      .project({ recipeSelections: 1 })
      .toArray(),
    db
      .collection<RecipeVersionDocument>('recipe_versions')
      .find({ recipeId: { $in: recipeIds } })
      .toArray(),
  ])
  const referencedVersionIds = collectVersionReferences(
    [...activeRuns, ...histories],
    new Set(recipeIds),
  )
  const versionCollection =
    db.collection<RecipeVersionDocument>('recipe_versions')
  const referencedVersions = versions.filter((version) =>
    referencedVersionIds.has(version._id),
  )

  for (const version of referencedVersions) {
    await versionCollection.updateOne(
      { _id: version._id },
      {
        $set: {
          ownerId: deletedAccountOwnerId,
          title: 'Recipe unavailable',
          status: 'draft',
          visibility: 'private',
          origin: 'authored',
          importReviewStatus: 'not-required',
        },
        $unset: historicalVersionUnset,
      },
    )
  }

  await Promise.all([
    versionCollection.deleteMany({
      recipeId: { $in: recipeIds },
      _id: { $nin: [...referencedVersionIds] },
    }),
    db.collection('recipe_shares').deleteMany({ recipeId: { $in: recipeIds } }),
    db.collection('recipe_saves').deleteMany({ recipeId: { $in: recipeIds } }),
    recipes.deleteMany({ _id: { $in: recipeIds }, ownerId: userId }),
  ])

  return {
    deletedPrivateRecipes: recipeIds.length,
    anonymizedHistoricalVersions: referencedVersions.length,
    deletedUnreferencedVersions: versions.length - referencedVersions.length,
  }
}

/**
 * Keep approved public imports available after their importing account is
 * deleted. Public catalog content is not private authorship: preserve its
 * source and rights provenance, but detach the catalog record and immutable
 * versions from the deleted account so ownership cannot silently survive it.
 */
export async function anonymizePublicImportedAccountContent(
  db: Db,
  userId: string,
): Promise<PublicImportDeletionResult> {
  const recipes = db.collection<RecipeDraftDocument>('recipes')
  const publicImports = await recipes
    .find({
      ownerId: userId,
      origin: 'imported',
      importReviewStatus: 'approved',
      status: 'usable',
      visibility: 'public',
    })
    .project({ _id: 1 })
    .toArray()
  const recipeIds = publicImports.map(({ _id }) => _id)
  if (recipeIds.length === 0) {
    return { anonymizedPublicRecipes: 0, anonymizedPublicVersions: 0 }
  }

  const updatedAt = isoDateTime(new Date())
  const [recipeUpdate, versionUpdate] = await Promise.all([
    recipes.updateMany(
      {
        _id: { $in: recipeIds },
        ownerId: userId,
        origin: 'imported',
        importReviewStatus: 'approved',
        status: 'usable',
        visibility: 'public',
      },
      { $set: { ownerId: deletedAccountOwnerId, updatedAt } },
    ),
    db
      .collection<RecipeVersionDocument>('recipe_versions')
      .updateMany(
        { recipeId: { $in: recipeIds }, ownerId: userId },
        { $set: { ownerId: deletedAccountOwnerId } },
      ),
  ])

  return {
    anonymizedPublicRecipes: recipeUpdate.modifiedCount,
    anonymizedPublicVersions: versionUpdate.modifiedCount,
  }
}

/** Remove account-owned membership and user-scoped artifacts after auth deletion. */
export async function removeAccountMembershipAndPrivateArtifacts(
  db: Db,
  userId: string,
) {
  await Promise.all([
    db.collection<ListDocument>('lists').updateMany(
      { members: { $elemMatch: { userId, invitationState: 'active' } } },
      {
        $pull: { members: { userId }, ownerIds: userId },
        $set: { updatedAt: isoDateTime(new Date()) },
      },
    ),
    db.collection('list_invitations').deleteMany({ inviterId: userId }),
    db.collection('notifications').deleteMany({ userId }),
    db.collection('account_exports').deleteMany({ userId }),
    db.collection('recipe_imports').deleteMany({ userId }),
    db.collection('recipe_saves').deleteMany({ userId }),
  ])
  await db
    .collection('shopping_run_history')
    .updateMany(
      { completedByUserId: userId },
      { $set: { completedByUserId: deletedAccountOwnerId } },
    )
}

export async function getAccountDeletionOwnershipBlockers(
  db: Db,
  userId: string,
): Promise<AccountDeletionOwnershipBlocker[]> {
  const lists = await db
    .collection<Pick<ListDocument, '_id' | 'name' | 'ownerIds' | 'members'>>(
      'lists',
    )
    .find({
      ...listMembershipFilter(userId),
      ownerIds: userId,
    })
    .project({ _id: 1, name: 1, ownerIds: 1, members: 1 })
    .sort({ _id: 1 })
    .toArray()

  return lists
    .filter((list) => list.ownerIds.length === 1)
    .map((list) => ({
      listId: entityId(list._id),
      listName: list.name,
      activeMemberCount: list.members.filter(
        (member) => member.invitationState === 'active',
      ).length,
    }))
}

/**
 * Return only the counts and list names needed to explain account deletion.
 * The query is scoped to the current user and never returns recipe or grocery
 * content to the settings surface.
 */
export async function getAccountDeletionImpact(
  db: Db,
  userId: string,
): Promise<AccountDeletionImpact> {
  const memberLists = await db
    .collection<ListDocument>('lists')
    .find(listMembershipFilter(userId))
    .project({ _id: 1, name: 1, ownerIds: 1, members: 1 })
    .sort({ _id: 1 })
    .toArray()

  const ownedLists = memberLists.filter((list) =>
    list.ownerIds.includes(userId),
  )
  const soleOwnerLists = ownedLists
    .filter((list) => list.ownerIds.length === 1)
    .map((list) => list.name)
  const soleOwnerListDetails = ownedLists
    .filter((list) => list.ownerIds.length === 1)
    .map((list) => ({
      listId: entityId(list._id),
      listName: list.name,
      activeMemberCount: list.members.filter(
        (member) => member.invitationState === 'active',
      ).length,
    }))

  const [memberships, manuallyAuthoredRecipes, publicImportedRecipes, history] =
    await Promise.all([
      Promise.resolve(memberLists.length),
      db.collection<RecipeDraftDocument>('recipes').countDocuments({
        ownerId: userId,
        status: { $in: ['draft', 'usable'] },
        $or: [{ origin: { $exists: false } }, { origin: 'authored' }],
      }),
      db.collection<RecipeDraftDocument>('recipes').countDocuments({
        ownerId: userId,
        origin: 'imported',
        importReviewStatus: 'approved',
        status: 'usable',
        visibility: 'public',
      }),
      memberLists.length === 0
        ? Promise.resolve(0)
        : db.collection('shopping_run_history').countDocuments({
            listId: { $in: memberLists.map((list) => list._id) },
          }),
    ])

  return {
    ownedLists: ownedLists.length,
    soleOwnerLists,
    soleOwnerListDetails,
    memberships,
    manuallyAuthoredRecipes,
    publicImportedRecipes,
    completedShoppingRuns: history,
  }
}
