import type { ClientSession, Collection } from 'mongodb'
import { z } from 'zod'
import {
  entityId,
  isoDateTime,
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

const listNameSchema = z
  .string({ error: 'Enter a list name.' })
  .trim()
  .min(1, 'Enter a list name.')
  .max(100, 'List names must be 100 characters or fewer.')

export const listIdSchema = z
  .string({ error: 'Enter a list id.' })
  .min(1, 'Enter a list id.')
  .max(100, 'List ids must be 100 characters or fewer.')
  .refine(
    (value) => !/[\u0000-\u001F\u007F]/.test(value),
    'List ids cannot contain control characters.',
  )

export const createListSchema = z.object({ name: listNameSchema })
export const updateListSchema = z.object({ name: listNameSchema })

export type ListRole = 'owner' | 'editor'
export type ListStatus = 'active' | 'archived' | 'deleted'

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
  ordering: unknown[]
  selectionMutationReceipts?: SelectionMutationReceipt[]
  manualMutationReceipts?: ManualGroceryMutationReceipt[]
  groceryOverrideMutationReceipts?: GroceryOverrideMutationReceipt[]
  groceryMergeSplits?: GroceryMergeSplitDocument[]
  grocerySplitMutationReceipts?: GrocerySplitMutationReceipt[]
  alreadyHaveItems?: GroceryAlreadyHaveDocument[]
  groceryAlreadyHaveMutationReceipts?: GroceryAlreadyHaveMutationReceipt[]
  groceryCategoryOverrides?: GroceryCategoryOverrideDocument[]
  groceryCategoryOverrideMutationReceipts?: GroceryCategoryOverrideMutationReceipt[]
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
