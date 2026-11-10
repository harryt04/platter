import { describe, expect, it, vi } from 'vitest'
import {
  pinnedRecipeVersionReferenceSchema,
  resolvePinnedRecipeVersions,
} from '@/lib/recipes/versions'

const version = (overrides: Record<string, unknown> = {}) => ({
  _id: 'version-1',
  recipeId: 'recipe-1',
  versionNumber: 1,
  ownerId: 'user-1',
  title: 'Tomato soup',
  status: 'usable' as const,
  visibility: 'private' as const,
  ingredients: [],
  instructions: [],
  createdAt: '2026-09-10T12:00:00.000Z' as `${string}`,
  updatedAt: '2026-09-10T12:00:00.000Z' as `${string}`,
  ...overrides,
})

const reference = {
  recipeId: 'recipe-1',
  versionId: 'version-1',
  versionNumber: 1,
}

function collectionWith(...documents: ReturnType<typeof version>[]) {
  const toArray = vi.fn().mockResolvedValue(documents)
  const find = vi.fn().mockReturnValue({ toArray })
  return { collection: { find }, find, toArray }
}

describe('pinned recipe versions', () => {
  it('preserves run order and duplicate selections while loading one snapshot per id', async () => {
    const collection = collectionWith(
      version(),
      version({
        _id: 'version-2',
        versionNumber: 2,
        title: 'Updated tomato soup',
      }),
    )
    const references = [
      reference,
      { ...reference, versionId: 'version-2', versionNumber: 2 },
      reference,
    ]

    const resolutions = await resolvePinnedRecipeVersions(
      collection.collection as never,
      references,
    )

    expect(collection.find).toHaveBeenCalledWith({
      _id: { $in: ['version-1', 'version-2'] },
    })
    expect(resolutions.map(({ version: resolved }) => resolved?._id)).toEqual([
      'version-1',
      'version-2',
      'version-1',
    ])
  })

  it('does not substitute the current or another recipe version for a missing snapshot', async () => {
    const collection = collectionWith(
      version({ _id: 'version-2', versionNumber: 2 }),
    )

    const [resolution] = await resolvePinnedRecipeVersions(
      collection.collection as never,
      [reference],
    )

    expect(resolution.version).toBeNull()
  })

  it('rejects a snapshot whose recipe identity or version number does not match the run reference', async () => {
    const collection = collectionWith(
      version({ recipeId: 'another-recipe', versionNumber: 9 }),
    )

    const [resolution] = await resolvePinnedRecipeVersions(
      collection.collection as never,
      [reference],
    )

    expect(resolution.version).toBeNull()
  })

  it('validates positive opaque immutable references', () => {
    expect(
      pinnedRecipeVersionReferenceSchema.safeParse(reference).success,
    ).toBe(true)
    expect(
      pinnedRecipeVersionReferenceSchema.safeParse({
        ...reference,
        versionNumber: 0,
      }).success,
    ).toBe(false)
    expect(
      pinnedRecipeVersionReferenceSchema.safeParse({
        ...reference,
        versionId: 'version-\u0000-1',
      }).success,
    ).toBe(false)
  })
})
