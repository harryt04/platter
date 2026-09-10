import { describe, expect, it } from 'vitest'
import {
  createDraftDocument,
  createDraftSchema,
  draftOwnerFilter,
  privateDraftFilter,
  toRecipeDraft,
} from '@/lib/recipes/drafts'

describe('recipe drafts', () => {
  it('accepts a trimmed title and rejects blank or oversized titles', () => {
    expect(createDraftSchema.parse({ title: '  Tomato soup  ' }).title).toBe(
      'Tomato soup',
    )
    expect(createDraftSchema.safeParse({ title: ' ' }).success).toBe(false)
    expect(
      createDraftSchema.safeParse({ title: 'x'.repeat(201) }).success,
    ).toBe(false)
  })

  it('creates private drafts owned by the authenticated user', () => {
    const draft = createDraftDocument('user-1', 'Tomato soup')

    expect(draft).toMatchObject({
      ownerId: 'user-1',
      title: 'Tomato soup',
      status: 'draft',
      visibility: 'private',
    })
    expect(toRecipeDraft(draft).id).toBe(draft._id)
    expect(draft.createdAt).toBe(draft.updatedAt)
  })

  it('scopes every lookup to both the draft id and owner', () => {
    expect(draftOwnerFilter('user-1', 'draft-1')).toEqual({
      _id: 'draft-1',
      ownerId: 'user-1',
    })
    expect(draftOwnerFilter('user-1')).toEqual({ ownerId: 'user-1' })
    expect(privateDraftFilter('user-1', 'draft-1')).toEqual({
      _id: 'draft-1',
      ownerId: 'user-1',
      status: 'draft',
      visibility: 'private',
    })
  })
})
