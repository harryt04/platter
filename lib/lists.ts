import type { ClientSession, Collection } from 'mongodb'
import { z } from 'zod'
import {
  entityId,
  isoDateTime,
  opaqueIdSchema,
  shoppingRunIdSchema,
  type EntityId,
  type IsoDateTime,
} from '@/lib/contracts/ids'
import { getConnectedDatabase, getMongoClient } from '@/lib/db/mongo-client'
import type {
  RecipeSelectionDocument,
  SelectionMutationReceipt,
} from '@/lib/recipes/selections'
import type {
  ManualGroceryAdditionDocument,
  ManualGroceryMutationReceipt,
} from '@/lib/recipes/manual-groceries'
import type {
  GroceryAmountOverrideDocument,
  GroceryOverrideMutationReceipt,
} from '@/lib/recipes/grocery-overrides'
import type {
  GroceryMergeSplitDocument,
  GrocerySplitMutationReceipt,
} from '@/lib/recipes/grocery-splits'
import type {
  GroceryAlreadyHaveDocument,
  GroceryAlreadyHaveMutationReceipt,
} from '@/lib/recipes/grocery-already-have'
import type {
  GroceryCategoryOverrideDocument,
  GroceryCategoryOverrideMutationReceipt,
} from '@/lib/recipes/grocery-categories-overrides'
import type { GroceryItemOrderMutationReceipt } from '@/lib/recipes/grocery-ordering'
import type { GroceryCategoryOrderMutationReceipt } from '@/lib/recipes/grocery-category-ordering'
import type { GroceryCategory } from '@/lib/recipes/grocery-categories'
import type {
  GroceryPurchasedDocument,
  GroceryPurchasedMutationReceipt,
} from '@/lib/recipes/grocery-purchased'
import { sanitizePlainText } from '@/lib/contracts/text'

const listNameSchema = z
  .string({ error: 'Enter a list name.' })
  .transform(sanitizePlainText)
  .pipe(
    z
      .string()
      .min(1, 'Enter a list name.')
      .max(100, 'List names must be 100 characters or fewer.'),
  )

export const listIdSchema = z
  .string({ error: 'Enter a list id.' })
  .min(1, 'Enter a list id.')
  .max(100, 'List ids must be 100 characters or fewer.')
  .refine(
    (value) => !/[\u0000-\u001F\u007F]/.test(value),
    'List ids cannot contain control characters.',
  )

const listRoleSchema = z.enum(['owner', 'editor'])
const listStatusSchema = z.enum(['active', 'archived', 'deleted'])
export const listMemberSchema = z.strictObject({
  userId: opaqueIdSchema,
  role: listRoleSchema,
  invitationState: z.literal('active'),
})

/** Runtime boundary for the owner-only list members response. */
export const listMembersResponseSchema = z.strictObject({
  members: z.array(listMemberSchema),
})

/** Runtime boundary for the list data exposed to clients. */
export const platterListSchema = z.strictObject({
  id: listIdSchema,
  name: z.string().min(1).max(100),
  ownerIds: z.array(opaqueIdSchema).min(1),
  status: listStatusSchema,
  activeRunId: shoppingRunIdSchema,
  members: z.array(listMemberSchema).min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

/** Runtime boundary for the authenticated list collection response. */
export const listCollectionResponseSchema = z.strictObject({
  lists: z.array(platterListSchema),
})

/** Runtime boundary for list mutation responses. */
export const listResponseSchema = z.strictObject({
  list: platterListSchema,
})

/** Runtime boundary for atomic list creation responses. */
export const createListResponseSchema = z.strictObject({
  list: platterListSchema,
  activeRunId: shoppingRunIdSchema,
})

export const createListSchema = z.object({ name: listNameSchema })
export const updateListSchema = z.object({ name: listNameSchema })

export type ListRole = 'owner' | 'editor'
export type ListStatus = 'active' | 'archived' | 'deleted'

export type CompletionMutationReceipt = {
  operationId: string
  clientId: string
  status: 200
  response: Record<string, unknown>
}

export type ListMember = {
  userId: string
  role: ListRole
  invitationState: 'active'
}

export type ShoppingRunDocument = {
  _id: string
  listId: string
  state: 'active'
  revision: number
  recipeSelections: RecipeSelectionDocument[]
  groceryItems: unknown[]
  manualAdditions: ManualGroceryAdditionDocument[]
  groceryAmountOverrides?: GroceryAmountOverrideDocument[]
  /** Explicit item order for this active run only; absent IDs are ignored. */
  ordering: string[]
  /** Explicit category order for this active run only; absent categories are ignored. */
  categoryOrdering?: GroceryCategory[]
  selectionMutationReceipts?: SelectionMutationReceipt[]
  manualMutationReceipts?: ManualGroceryMutationReceipt[]
  groceryOverrideMutationReceipts?: GroceryOverrideMutationReceipt[]
  groceryMergeSplits?: GroceryMergeSplitDocument[]
  grocerySplitMutationReceipts?: GrocerySplitMutationReceipt[]
  alreadyHaveItems?: GroceryAlreadyHaveDocument[]
  groceryAlreadyHaveMutationReceipts?: GroceryAlreadyHaveMutationReceipt[]
  purchasedItems?: GroceryPurchasedDocument[]
  groceryPurchasedMutationReceipts?: GroceryPurchasedMutationReceipt[]
  groceryCategoryOverrides?: GroceryCategoryOverrideDocument[]
  groceryCategoryOverrideMutationReceipts?: GroceryCategoryOverrideMutationReceipt[]
  groceryItemOrderMutationReceipts?: GroceryItemOrderMutationReceipt[]
  groceryCategoryOrderMutationReceipts?: GroceryCategoryOrderMutationReceipt[]
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export type ListDocument = {
  _id: string
  name: string
  ownerIds: string[]
  status: ListStatus
  activeRunId: string
  members: ListMember[]
  completionMutationReceipts?: CompletionMutationReceipt[]
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export type PlatterList = {
  id: EntityId
  name: string
  ownerIds: string[]
  status: ListStatus
  activeRunId: EntityId
  members: ListMember[]
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export function lists(collection: Collection<ListDocument>) {
  return collection
}

export function shoppingRuns(collection: Collection<ShoppingRunDocument>) {
  return collection
}

export function listMemberFilter(listId: string, userId: string) {
  return {
    _id: listId,
    status: { $ne: 'deleted' as const },
    members: { $elemMatch: { userId, invitationState: 'active' as const } },
  }
}

export function listOwnerFilter(listId: string, userId: string) {
  return {
    _id: listId,
    status: { $ne: 'deleted' as const },
    members: {
      $elemMatch: {
        userId,
        role: 'owner' as const,
        invitationState: 'active' as const,
      },
    },
  }
}

export function listEditorFilter(listId: string, userId: string) {
  return {
    _id: listId,
    status: { $ne: 'deleted' as const },
    members: {
      $elemMatch: {
        userId,
        role: 'editor' as const,
        invitationState: 'active' as const,
      },
    },
  }
}

export function listRoleFilter(
  listId: string,
  userId: string,
  roles: readonly ListRole[] = ['owner', 'editor'],
) {
  return {
    _id: listId,
    status: { $ne: 'deleted' as const },
    members: {
      $elemMatch: {
        userId,
        role: roles.length === 1 ? roles[0] : { $in: roles },
        invitationState: 'active' as const,
      },
    },
  }
}

export function listMembershipFilter(userId: string) {
  return {
    status: { $ne: 'deleted' as const },
    members: { $elemMatch: { userId, invitationState: 'active' as const } },
  }
}

export function listAcceptsShoppingOperations(
  list: Pick<ListDocument, 'status'>,
) {
  return list.status === 'active'
}

export async function findListForMember(listId: string, userId: string) {
  if (!listIdSchema.safeParse(listId).success) return null
  const db = await getConnectedDatabase()
  return db
    .collection<ListDocument>('lists')
    .findOne(listMemberFilter(listId, userId))
}

export async function findActiveShoppingRun(
  list: Pick<ListDocument, 'activeRunId' | '_id'>,
) {
  const db = await getConnectedDatabase()
  return db.collection<ShoppingRunDocument>('shopping_runs').findOne({
    _id: list.activeRunId,
    listId: list._id,
    state: 'active',
  })
}

export function createListDocument(
  ownerId: string,
  name: string,
  activeRunId: string,
  now = new Date(),
): ListDocument {
  const timestamp = isoDateTime(now)
  return {
    _id: crypto.randomUUID(),
    name,
    ownerIds: [ownerId],
    status: 'active',
    activeRunId,
    members: [{ userId: ownerId, role: 'owner', invitationState: 'active' }],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function createActiveShoppingRunDocument(
  listId: string,
  now = new Date(),
): ShoppingRunDocument {
  const timestamp = isoDateTime(now)
  return {
    _id: crypto.randomUUID(),
    listId,
    state: 'active',
    revision: 0,
    recipeSelections: [],
    groceryItems: [],
    manualAdditions: [],
    groceryAmountOverrides: [],
    groceryMergeSplits: [],
    alreadyHaveItems: [],
    purchasedItems: [],
    groceryCategoryOverrides: [],
    ordering: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function toPlatterList(document: ListDocument): PlatterList {
  return {
    id: entityId(document._id),
    name: document.name,
    ownerIds: document.ownerIds,
    status: document.status,
    activeRunId: entityId(document.activeRunId),
    members: document.members,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }
}

export async function createListWithActiveRun(
  ownerId: string,
  name: string,
): Promise<{ list: ListDocument; run: ShoppingRunDocument }> {
  const db = await getConnectedDatabase()
  const client = getMongoClient()
  const runId = crypto.randomUUID()
  const list = createListDocument(ownerId, name, runId)
  const run = createActiveShoppingRunDocument(list._id)
  run._id = runId

  await client.withSession(async (session) => {
    await session.withTransaction(async (transactionSession: ClientSession) => {
      await lists(db.collection<ListDocument>('lists')).insertOne(list, {
        session: transactionSession,
      })
      await shoppingRuns(
        db.collection<ShoppingRunDocument>('shopping_runs'),
      ).insertOne(run, { session: transactionSession })
    })
  })

  return { list, run }
}
