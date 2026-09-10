import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/v1/lists/[listId]/history/route'

const { getSession, findListForMember, getConnectedDatabase, searchHistory } =
  vi.hoisted(() => ({
    getSession: vi.fn(),
    findListForMember: vi.fn(),
    getConnectedDatabase: vi.fn(),
    searchHistory: vi.fn(),
  }))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/lists', () => ({
  findListForMember,
  listIdSchema: {
    safeParse: (value: string) => ({ success: value.length > 0 }),
  },
}))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))
vi.mock('@/lib/shopping-run-history', () => ({
  decodeShoppingRunHistoryCursor: vi.fn((value: string) =>
    value === 'valid'
      ? {
          localDate: '2026-09-10',
          completedAt: '2026-09-10T18:00:00.000Z',
          id: 'history-1',
        }
      : null,
  ),
  searchShoppingRunHistory: searchHistory,
}))

function context(listId = 'list-1') {
  return { params: Promise.resolve({ listId }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'user-1' } })
  findListForMember.mockResolvedValue({ _id: 'list-1' })
  getConnectedDatabase.mockResolvedValue({})
  searchHistory.mockResolvedValue({
    entries: [
      {
        _id: 'history-1',
        listId: 'list-1',
        completedAt: '2026-09-10T18:00:00.000Z',
        localDate: '2026-09-10',
        completedByUserId: 'user-1',
        recipeSelections: [],
      },
    ],
    nextCursor: 'next-history-cursor',
  })
})

describe('GET /api/v1/lists/[listId]/history', () => {
  it('requires authentication and current list membership', async () => {
    getSession.mockResolvedValueOnce(null)
    expect(
      (
        await GET(
          new Request('http://localhost/api/v1/lists/list-1/history'),
          context(),
        )
      ).status,
    ).toBe(401)

    getSession.mockResolvedValueOnce({ user: { id: 'outsider' } })
    findListForMember.mockResolvedValueOnce(null)
    expect(
      (
        await GET(
          new Request('http://localhost/api/v1/lists/list-1/history'),
          context(),
        )
      ).status,
    ).toBe(404)
    expect(searchHistory).not.toHaveBeenCalled()
  })

  it('validates cursors and returns the authorized list page', async () => {
    const invalid = await GET(
      new Request('http://localhost/api/v1/lists/list-1/history?cursor=bad'),
      context(),
    )
    expect(invalid.status).toBe(422)

    const response = await GET(
      new Request(
        'http://localhost/api/v1/lists/list-1/history?pageSize=10&cursor=valid',
      ),
      context(),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      history: expect.any(Array),
      nextCursor: 'next-history-cursor',
    })
    expect(findListForMember).toHaveBeenCalledWith('list-1', 'user-1')
    expect(searchHistory).toHaveBeenCalledWith({}, 'list-1', {
      cursor: 'valid',
      pageSize: 10,
    })
  })
})
