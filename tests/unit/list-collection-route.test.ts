import { describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/v1/lists/route'

const { createListWithActiveRun, getSession } = vi.hoisted(() => ({
  createListWithActiveRun: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/lists', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/lists')>('@/lib/lists')
  return { ...actual, createListWithActiveRun }
})

const list = {
  _id: 'list-1',
  name: 'Family',
  ownerIds: ['user-1'],
  status: 'active' as const,
  activeRunId: 'run-1',
  members: [
    {
      userId: 'user-1',
      role: 'owner' as const,
      invitationState: 'active' as const,
    },
  ],
  createdAt: '2026-09-10T12:00:00.000Z' as `${string}`,
  updatedAt: '2026-09-10T12:00:00.000Z' as `${string}`,
}

describe('POST /api/v1/lists', () => {
  it('returns a stable retryable problem when creation fails', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    createListWithActiveRun.mockRejectedValue(new Error('database offline'))

    const response = await POST(
      new Request('http://localhost/api/v1/lists', {
        method: 'POST',
        body: JSON.stringify({ name: 'Family' }),
      }),
    )

    expect(response.status).toBe(503)
    expect(response.headers.get('content-type')).toContain(
      'application/problem+json',
    )
    expect((await response.json()).code).toBe('LIST_CREATION_FAILED')
  })

  it('validates the created list envelope before returning it', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    createListWithActiveRun.mockResolvedValue({ list, run: { _id: 'run-1' } })

    const response = await POST(
      new Request('http://localhost/api/v1/lists', {
        method: 'POST',
        body: JSON.stringify({ name: 'Family' }),
      }),
    )

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({
      list: {
        id: 'list-1',
        name: 'Family',
        ownerIds: ['user-1'],
        status: 'active',
        activeRunId: 'run-1',
        members: [
          { userId: 'user-1', role: 'owner', invitationState: 'active' },
        ],
        createdAt: '2026-09-10T12:00:00.000Z',
        updatedAt: '2026-09-10T12:00:00.000Z',
      },
      activeRunId: 'run-1',
    })
  })
})
