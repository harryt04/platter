import type { Db } from 'mongodb'
import { describe, expect, it, vi } from 'vitest'
import {
  createRepeatedRecipeSelection,
  decodeShoppingRunHistoryCursor,
  findShoppingRunHistory,
  formatShoppingRunHistoryDate,
  searchShoppingRunHistory,
} from '@/lib/shopping-run-history'
import type { ShoppingRunHistoryDocument } from '@/lib/shopping-run-history'

function query(documents: ShoppingRunHistoryDocument[]) {
  const cursor = {
    sort: vi.fn(() => cursor),
    limit: vi.fn(() => cursor),
    toArray: vi.fn().mockResolvedValue(documents),
  }
  return {
    find: vi.fn(() => cursor),
    cursor,
  }
}

function history(
  id: string,
  localDate: string,
  completedAt: string,
): ShoppingRunHistoryDocument {
  return {
    _id: id,
    listId: 'list-1',
    localDate,
    completedAt: completedAt as ShoppingRunHistoryDocument['completedAt'],
    completedByUserId: 'user-1',
    recipeSelections: [],
  }
}

describe('shopping run history', () => {
  it('rebuilds a fresh selection from only the historical version and people count', () => {
    const selection = createRepeatedRecipeSelection(
      {
        _id: 'old-selection',
        recipeId: 'recipe-1',
        versionId: 'version-3',
        versionNumber: 3,
        desiredPeople: 6,
      },
      {
        _id: 'version-3',
        recipeId: 'recipe-1',
        versionNumber: 3,
        typicalPeopleFed: 4,
      },
      new Date('2026-09-10T18:00:00.000Z'),
    )

    expect(selection).toMatchObject({
      recipeId: 'recipe-1',
      versionId: 'version-3',
      versionNumber: 3,
      desiredPeople: 6,
      scaleFactor: '1.5',
    })
    expect(selection._id).not.toBe('old-selection')
    expect(Object.keys(selection).sort()).toEqual([
      '_id',
      'createdAt',
      'desiredPeople',
      'recipeId',
      'scaleFactor',
      'updatedAt',
      'versionId',
      'versionNumber',
    ])
  })

  it('rejects a mismatched historical version instead of silently repinning', () => {
    expect(() =>
      createRepeatedRecipeSelection(
        {
          _id: 'old-selection',
          recipeId: 'recipe-1',
          versionId: 'version-3',
          versionNumber: 3,
          desiredPeople: 2,
        },
        {
          _id: 'version-4',
          recipeId: 'recipe-1',
          versionNumber: 4,
          typicalPeopleFed: 4,
        },
      ),
    ).toThrow('The historical recipe version does not match.')
  })

  it('finds one entry only within its authorized list', async () => {
    const histories = {
      findOne: vi
        .fn()
        .mockResolvedValue(
          history('history-1', '2026-09-10', '2026-09-10T18:00:00.000Z'),
        ),
    }
    const db = {
      collection: vi.fn(() => histories),
    } as unknown as Db

    await expect(
      findShoppingRunHistory(db, 'list-1', 'history-1'),
    ).resolves.toMatchObject({ _id: 'history-1', listId: 'list-1' })
    expect(histories.findOne).toHaveBeenCalledWith({
      _id: 'history-1',
      listId: 'list-1',
    })

    await expect(
      findShoppingRunHistory(db, 'list-1', 'bad\u0000id'),
    ).resolves.toBeNull()
    expect(histories.findOne).toHaveBeenCalledOnce()
  })

  it('returns a stable date-time-id page and cursor', async () => {
    const histories = query([
      history('history-1', '2026-09-10', '2026-09-10T18:00:00.000Z'),
      history('history-2', '2026-09-09', '2026-09-09T18:00:00.000Z'),
      history('history-3', '2026-09-08', '2026-09-08T18:00:00.000Z'),
    ])
    const db = {
      collection: vi.fn(() => histories),
    } as unknown as Db

    const firstPage = await searchShoppingRunHistory(db, 'list-1', {
      pageSize: 2,
    })

    expect(firstPage.entries.map(({ _id }) => _id)).toEqual([
      'history-1',
      'history-2',
    ])
    expect(firstPage.nextCursor).toBeDefined()
    expect(decodeShoppingRunHistoryCursor(firstPage.nextCursor ?? '')).toEqual({
      localDate: '2026-09-09',
      completedAt: '2026-09-09T18:00:00.000Z',
      id: 'history-2',
    })
    expect(histories.find).toHaveBeenCalledWith({ listId: 'list-1' })
    expect(histories.cursor.sort).toHaveBeenCalledWith({
      localDate: -1,
      completedAt: -1,
      _id: -1,
    })
    expect(histories.cursor.limit).toHaveBeenCalledWith(3)

    await searchShoppingRunHistory(db, 'list-1', {
      cursor: firstPage.nextCursor,
      pageSize: 2,
    })
    expect(histories.find).toHaveBeenLastCalledWith({
      listId: 'list-1',
      $or: [
        { localDate: { $lt: '2026-09-09' } },
        {
          localDate: '2026-09-09',
          completedAt: { $lt: '2026-09-09T18:00:00.000Z' },
        },
        {
          localDate: '2026-09-09',
          completedAt: '2026-09-09T18:00:00.000Z',
          _id: { $lt: 'history-2' },
        },
      ],
    })
  })

  it('formats a stored local calendar date without shifting it by timezone', () => {
    expect(formatShoppingRunHistoryDate('2026-09-10', 'en-US')).toBe(
      'Sep 10, 2026',
    )
    expect(formatShoppingRunHistoryDate('2026-09-10', 'de-DE')).toMatch(
      /10.*2026/,
    )
  })
})
