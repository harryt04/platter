import { describe, expect, it } from 'vitest'
import { safeReturnPath } from '@/lib/auth/return-to'
import { opaqueCursorSchema, opaqueIdSchema } from '@/lib/contracts/ids'
import { createComplaintDocument, toComplaintReceipt } from '@/lib/complaints'
import {
  listEditorFilter,
  listMemberFilter,
  listOwnerFilter,
} from '@/lib/lists'
import { parseAnalyticsEvent } from '@/lib/analytics'
import { sanitizePlainText } from '@/lib/contracts/text'
import {
  isPubliclyRenderableRecipe,
  publicRecipeFilter,
  recipeMetadataSchema,
  updateDraftSchema,
} from '@/lib/recipes/drafts'

describe('security regression boundaries', () => {
  it('keeps list authorization scoped to both the requested list and role', () => {
    expect(listMemberFilter('list-a', 'member-a')).toEqual({
      _id: 'list-a',
      status: { $ne: 'deleted' },
      members: {
        $elemMatch: { userId: 'member-a', invitationState: 'active' },
      },
    })
    expect(listOwnerFilter('list-a', 'member-a').members).toEqual({
      $elemMatch: {
        userId: 'member-a',
        role: 'owner',
        invitationState: 'active',
      },
    })
    expect(listEditorFilter('list-a', 'member-a').members).toEqual({
      $elemMatch: {
        userId: 'member-a',
        role: 'editor',
        invitationState: 'active',
      },
    })
    expect(listMemberFilter('list-a', 'member-a')).not.toMatchObject({
      _id: 'list-b',
    })
  })

  it('requires the complete public recipe boundary before rendering imported content', () => {
    expect(publicRecipeFilter()).toMatchObject({
      status: 'usable',
      visibility: 'public',
      $or: expect.arrayContaining([
        { origin: 'imported', importReviewStatus: 'approved' },
      ]),
    })
    expect(
      isPubliclyRenderableRecipe({
        status: 'usable',
        visibility: 'public',
        origin: 'imported',
        importReviewStatus: 'pending',
      }),
    ).toBe(false)
    expect(
      isPubliclyRenderableRecipe({
        status: 'usable',
        visibility: 'public',
        origin: 'imported',
        importReviewStatus: 'approved',
      }),
    ).toBe(true)
  })

  it('rejects malformed opaque identifiers and cursors before storage use', () => {
    expect(opaqueIdSchema.safeParse('recipe-1').success).toBe(true)
    expect(opaqueIdSchema.safeParse('recipe-\u0000-1').success).toBe(false)
    expect(opaqueIdSchema.safeParse('x'.repeat(201)).success).toBe(false)
    expect(opaqueCursorSchema.safeParse('valid_cursor-1').success).toBe(true)
    expect(opaqueCursorSchema.safeParse('cursor with spaces').success).toBe(
      false,
    )
    expect(opaqueCursorSchema.safeParse('../secrets').success).toBe(false)
  })

  it('sanitizes authored content and rejects script-like source URLs', () => {
    expect(
      sanitizePlainText(
        '  <p>Dinner</p> <!-- private note --> &lt;script&gt;alert(1)&lt;/script&gt; plan\u0000  ',
      ),
    ).toBe('Dinner plan')
    expect(
      updateDraftSchema.parse({
        title: '  <strong>Dinner</strong>\u0000 plan  ',
        instructions: ['  <em>Stir</em>\u0007 gently  '],
      }),
    ).toMatchObject({
      title: 'Dinner plan',
      instructions: ['Stir gently'],
    })
    expect(
      recipeMetadataSchema.safeParse({ sourceUrl: 'javascript:alert(1)' })
        .success,
    ).toBe(false)
    expect(
      recipeMetadataSchema.safeParse({
        sourceUrl: 'https://user:password@example.test/recipe',
      }).success,
    ).toBe(false)
  })

  it('rejects content-bearing analytics and keeps complaint contacts out of receipts', () => {
    expect(
      parseAnalyticsEvent('recipe_opened', {
        visibility: 'public',
        recipeTitle: 'Private title',
      }),
    ).toBeNull()
    expect(
      parseAnalyticsEvent('import_outcome', {
        stage: 'saved',
        outcome: 'success',
        sourceUrl: 'https://private.example/recipe',
      }),
    ).toBeNull()

    const complaint = createComplaintDocument({
      type: 'copyright',
      sourceUrl: 'https://example.test/recipe',
      description: 'Please review this source.',
      contactName: 'Rights holder',
      contactEmail: 'rights@example.test',
    })
    expect(toComplaintReceipt(complaint)).not.toHaveProperty('contact')
    expect(toComplaintReceipt(complaint)).not.toHaveProperty('description')
  })

  it('allows only same-origin relative post-authentication paths', () => {
    expect(safeReturnPath('/lists/list-a')).toBe('/lists/list-a')
    expect(safeReturnPath('//evil.example/steal')).toBe('/lists')
    expect(safeReturnPath('/\\evil.example/steal')).toBe('/lists')
    expect(safeReturnPath('https://evil.example/steal')).toBe('/lists')
    expect(safeReturnPath('javascript:alert(1)')).toBe('/lists')
    expect(safeReturnPath(undefined)).toBe('/lists')
  })
})
