import { describe, expect, it, vi } from 'vitest'
import {
  completeAccountDeletionAudit,
  getAccountDeletionImpact,
  getAccountDeletionOwnershipBlockers,
  recordAccountDeletionPreparedAudit,
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

describe('account deletion audit', () => {
  it('uses one pseudonymous upsert for shared ownership and referenced recipe cleanup', async () => {
    const updateOne = vi.fn().mockResolvedValue({ acknowledged: true })
    const db = {
      collection: vi.fn(() => ({ updateOne })),
    } as never
    const input = {
      ownedLists: 2,
      coOwnedLists: 1,
      memberships: 3,
      manuallyAuthoredRecipes: 2,
      publicImportedRecipes: 1,
      completedShoppingRuns: 4,
      deletedPrivateRecipes: 2,
      anonymizedHistoricalVersions: 1,
      deletedUnreferencedVersions: 1,
      anonymizedPublicRecipes: 1,
      anonymizedPublicVersions: 2,
    }

    const firstFingerprint = await recordAccountDeletionPreparedAudit(
      db,
      'user-1',
      input,
      new Date('2026-09-10T12:00:00.000Z'),
    )
    const secondFingerprint = await recordAccountDeletionPreparedAudit(
      db,
      'user-1',
      input,
      new Date('2026-09-10T12:01:00.000Z'),
    )

    expect(secondFingerprint).toBe(firstFingerprint)
    expect(firstFingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(updateOne.mock.calls)).not.toContain('user-1')
    expect(updateOne).toHaveBeenNthCalledWith(
      1,
      { _id: firstFingerprint },
      expect.objectContaining({
        $set: expect.objectContaining({
          lastAttemptAt: '2026-09-10T12:00:00.000Z',
        }),
        $setOnInsert: expect.objectContaining({
          coOwnedLists: 1,
          anonymizedHistoricalVersions: 1,
          status: 'prepared',
          requestedAt: '2026-09-10T12:00:00.000Z',
        }),
      }),
      { upsert: true },
    )
    expect(updateOne).toHaveBeenNthCalledWith(
      2,
      { _id: firstFingerprint },
      expect.objectContaining({
        $set: { lastAttemptAt: '2026-09-10T12:01:00.000Z' },
        $setOnInsert: expect.objectContaining({
          status: 'prepared',
          requestedAt: '2026-09-10T12:01:00.000Z',
          ...input,
        }),
      }),
      { upsert: true },
    )

    await completeAccountDeletionAudit(
      db,
      'user-1',
      new Date('2026-09-10T12:02:00.000Z'),
    )
    expect(updateOne).toHaveBeenNthCalledWith(
      3,
      { _id: firstFingerprint },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'completed',
          completedAt: '2026-09-10T12:02:00.000Z',
        }),
      }),
      { upsert: true },
    )
  })
})
