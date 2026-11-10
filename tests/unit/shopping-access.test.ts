import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isoDateTime } from '@/lib/contracts/ids'
import { findListForMember, type ListDocument } from '@/lib/lists'

const { getConnectedDatabase } = vi.hoisted(() => ({
  getConnectedDatabase: vi.fn(),
}))

vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))

const list: ListDocument = {
  _id: 'list-1',
  name: 'Family',
  ownerIds: ['owner-1'],
  status: 'active',
  activeRunId: 'run-1',
  members: [
    { userId: 'owner-1', role: 'owner', invitationState: 'active' },
    { userId: 'editor-1', role: 'editor', invitationState: 'active' },
  ],
  createdAt: isoDateTime('2026-09-10T12:00:00.000Z'),
  updatedAt: isoDateTime('2026-09-10T12:00:00.000Z'),
}

describe('shopping checklist membership access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows both owner and editor memberships through the same scoped lookup', async () => {
    const findOne = vi.fn().mockResolvedValue(list)
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue({ findOne }),
    })

    await expect(findListForMember('list-1', 'owner-1')).resolves.toEqual(list)
    await expect(findListForMember('list-1', 'editor-1')).resolves.toEqual(list)

    expect(findOne).toHaveBeenNthCalledWith(1, {
      _id: 'list-1',
      status: { $ne: 'deleted' },
      members: {
        $elemMatch: {
          userId: 'owner-1',
          invitationState: 'active',
        },
      },
    })
    expect(findOne).toHaveBeenNthCalledWith(2, {
      _id: 'list-1',
      status: { $ne: 'deleted' },
      members: {
        $elemMatch: {
          userId: 'editor-1',
          invitationState: 'active',
        },
      },
    })
  })

  it('returns no list for a non-member and never broadens the lookup', async () => {
    const findOne = vi.fn().mockResolvedValue(null)
    getConnectedDatabase.mockResolvedValue({
      collection: vi.fn().mockReturnValue({ findOne }),
    })

    await expect(findListForMember('list-1', 'outsider-1')).resolves.toBeNull()
    expect(findOne).toHaveBeenCalledWith({
      _id: 'list-1',
      status: { $ne: 'deleted' },
      members: {
        $elemMatch: {
          userId: 'outsider-1',
          invitationState: 'active',
        },
      },
    })
  })

  it('rejects malformed checklist list ids before touching the database', async () => {
    await expect(
      findListForMember('list-\u0000-1', 'owner-1'),
    ).resolves.toBeNull()
    expect(getConnectedDatabase).not.toHaveBeenCalled()
  })
})
