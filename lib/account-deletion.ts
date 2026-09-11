import type { Db } from 'mongodb'
import { entityId, type EntityId } from '@/lib/contracts/ids'
import { listMembershipFilter, type ListDocument } from '@/lib/lists'
import type { RecipeDraftDocument } from '@/lib/recipes/drafts'

export type AccountDeletionOwnershipBlocker = {
  listId: EntityId
  listName: string
  activeMemberCount: number
}

export type AccountDeletionImpact = {
  ownedLists: number
  soleOwnerLists: string[]
  soleOwnerListDetails: AccountDeletionOwnershipBlocker[]
  memberships: number
  manuallyAuthoredRecipes: number
  publicImportedRecipes: number
  completedShoppingRuns: number
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
