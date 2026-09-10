import { describe, expect, it } from 'vitest'
import {
  createActiveShoppingRunDocument,
  createListDocument,
  createListSchema,
  listAcceptsShoppingOperations,
  listEditorFilter,
  listMemberFilter,
  listMembershipFilter,
  listOwnerFilter,
  updateListSchema,
} from '@/lib/lists'

describe('lists', () => {
  it('validates and trims names while rejecting blank or oversized values', () => {
    expect(createListSchema.parse({ name: '  Family  ' }).name).toBe('Family')
    expect(createListSchema.safeParse({ name: ' ' }).success).toBe(false)
    expect(createListSchema.safeParse({ name: 'x'.repeat(101) }).success).toBe(
      false,
    )
  })

  it('creates an owner membership and an empty active run', () => {
    const now = new Date('2026-09-10T12:00:00.000Z')
    const run = createActiveShoppingRunDocument('list-1', now)
    const list = createListDocument('user-1', 'Family', run._id, now)

    expect(list).toMatchObject({
      name: 'Family',
      ownerIds: ['user-1'],
      status: 'active',
      activeRunId: run._id,
      members: [{ userId: 'user-1', role: 'owner', invitationState: 'active' }],
    })
    expect(run).toMatchObject({
      listId: 'list-1',
      state: 'active',
      revision: 0,
      recipeSelections: [],
      groceryItems: [],
      manualAdditions: [],
      ordering: [],
    })
  })

  it('scopes list reads to active membership and the requested list id', () => {
    expect(listMembershipFilter('user-1')).toEqual({
      status: { $ne: 'deleted' },
      members: {
        $elemMatch: { userId: 'user-1', invitationState: 'active' },
      },
    })
    expect(listMemberFilter('list-1', 'user-1')).toEqual({
      _id: 'list-1',
      status: { $ne: 'deleted' },
      members: {
        $elemMatch: { userId: 'user-1', invitationState: 'active' },
      },
    })
    expect(listOwnerFilter('list-1', 'user-1')).toEqual({
      _id: 'list-1',
      status: { $ne: 'deleted' },
      members: {
        $elemMatch: {
          userId: 'user-1',
          role: 'owner',
          invitationState: 'active',
        },
      },
    })
    expect(listEditorFilter('list-1', 'editor-1')).toEqual({
      _id: 'list-1',
      status: { $ne: 'deleted' },
      members: {
        $elemMatch: {
          userId: 'editor-1',
          role: 'editor',
          invitationState: 'active',
        },
      },
    })
  })

  it('validates renamed list names with the same contract as creation', () => {
    expect(updateListSchema.parse({ name: '  Weeknight meals  ' }).name).toBe(
      'Weeknight meals',
    )
    expect(updateListSchema.safeParse({ name: ' ' }).success).toBe(false)
  })

  it('allows shopping operations only for active lists', () => {
    expect(listAcceptsShoppingOperations({ status: 'active' })).toBe(true)
    expect(listAcceptsShoppingOperations({ status: 'archived' })).toBe(false)
    expect(listAcceptsShoppingOperations({ status: 'deleted' })).toBe(false)
  })
})
import { decimalString, entityId, isoDateTime } from '@/lib/contracts/ids'
import { problemSchema } from '@/lib/contracts/problem'
import { listIdSchema } from '@/lib/lists'

describe('foundation contracts', () => {
  it('keeps boundary values opaque and serializable', () => {
    expect(entityId('recipe-1')).toBe('recipe-1')
    expect(decimalString(2.5)).toBe('2.5')
    expect(isoDateTime('2026-09-10T00:00:00.000Z')).toBe(
      '2026-09-10T00:00:00.000Z',
    )
  })
  it('validates problem responses', () => {
    expect(
      problemSchema.parse({
        type: 'x',
        title: 'Nope',
        status: 400,
        detail: 'Bad input',
        code: 'BAD',
      }).code,
    ).toBe('BAD')
  })

  it('treats list ids as bounded, opaque route input', () => {
    expect(listIdSchema.safeParse('list-1').success).toBe(true)
    expect(listIdSchema.safeParse('').success).toBe(false)
    expect(listIdSchema.safeParse(`list-${'x'.repeat(100)}`).success).toBe(
      false,
    )
    expect(listIdSchema.safeParse('list-\u0000-1').success).toBe(false)
  })
})
