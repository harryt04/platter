import { describe, expect, it, vi } from 'vitest'
import {
  getAccountDeletionImpact,
  getAccountDeletionOwnershipBlockers,
} from '@/lib/account-deletion'

describe('getAccountDeletionImpact', () => {
  it('counts only the current user’s active memberships and owned content', async () => {
    const lists = [
      {
        _id: 'list-1',
        name: 'Family',
        ownerIds: ['user-1'],
        members: [
          { userId: 'user-1', role: 'owner', invitationState: 'active' },
        ],
      },
      {
        _id: 'list-2',
        name: 'Friends',
        ownerIds: ['user-1', 'user-2'],
        members: [
          { userId: 'user-1', role: 'owner', invitationState: 'active' },
          { userId: 'user-2', role: 'owner', invitationState: 'active' },
        ],
      },
    ]
    const countDocuments = vi
      .fn()
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4)
    const db = {
      collection: vi.fn((name: string) => {
        if (name === 'lists') {
          return {
            find: () => ({
              project: () => ({
                sort: () => ({ toArray: async () => lists }),
              }),
            }),
          }
        }
        return { countDocuments }
      }),
    } as never

    await expect(getAccountDeletionImpact(db, 'user-1')).resolves.toEqual({
      ownedLists: 2,
      soleOwnerLists: ['Family'],
      soleOwnerListDetails: [
        { listId: 'list-1', listName: 'Family', activeMemberCount: 1 },
      ],
      memberships: 2,
      manuallyAuthoredRecipes: 2,
      publicImportedRecipes: 3,
      completedShoppingRuns: 4,
    })

    expect(countDocuments).toHaveBeenNthCalledWith(1, {
      ownerId: 'user-1',
      status: { $in: ['draft', 'usable'] },
      $or: [{ origin: { $exists: false } }, { origin: 'authored' }],
    })
    expect(countDocuments).toHaveBeenNthCalledWith(2, {
      ownerId: 'user-1',
      origin: 'imported',
      importReviewStatus: 'approved',
      status: 'usable',
      visibility: 'public',
    })
    expect(countDocuments).toHaveBeenNthCalledWith(3, {
      listId: { $in: ['list-1', 'list-2'] },
    })
  })

  it('returns only active lists where the user is the sole owner', async () => {
    const lists = [
      {
        _id: 'list-1',
        name: 'Family',
        ownerIds: ['user-1'],
        members: [
          { userId: 'user-1', role: 'owner', invitationState: 'active' },
          { userId: 'user-2', role: 'editor', invitationState: 'active' },
        ],
      },
      {
        _id: 'list-2',
        name: 'Shared',
        ownerIds: ['user-1', 'user-2'],
        members: [
          { userId: 'user-1', role: 'owner', invitationState: 'active' },
          { userId: 'user-2', role: 'owner', invitationState: 'active' },
        ],
      },
      {
        _id: 'list-3',
        name: 'Archived',
        ownerIds: ['user-1'],
        members: [
          { userId: 'user-1', role: 'owner', invitationState: 'active' },
        ],
      },
    ]
    const db = {
      collection: vi.fn().mockReturnValue({
        find: () => ({
          project: () => ({
            sort: () => ({ toArray: async () => lists.slice(0, 2) }),
          }),
        }),
      }),
    } as never

    await expect(
      getAccountDeletionOwnershipBlockers(db, 'user-1'),
    ).resolves.toEqual([
      { listId: 'list-1', listName: 'Family', activeMemberCount: 2 },
    ])
  })
})
