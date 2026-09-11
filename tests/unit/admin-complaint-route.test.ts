import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/v1/admin/complaints/route'
import { PATCH } from '@/app/api/v1/admin/complaints/[complaintId]/route'
import { isoDateTime } from '@/lib/contracts/ids'
import type { ComplaintDocument } from '@/lib/complaints'

const { getSession, getConnectedDatabase } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getConnectedDatabase: vi.fn(),
}))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))
vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))

const complaintId = 'b6f9e7a7-5e44-46a3-bf5c-1d2b2cb9c2b7'
const receivedAt = isoDateTime('2026-09-10T12:00:00.000Z')
const complaint: ComplaintDocument = {
  _id: complaintId,
  type: 'copyright' as const,
  status: 'received' as const,
  recipeId: 'recipe-1',
  sourceUrl: 'https://example.com/recipe',
  description: 'Please review this public recipe.',
  contact: { name: 'Rights holder', email: 'rights@example.com' },
  receivedAt,
  createdAt: receivedAt,
  updatedAt: receivedAt,
  statusHistory: [
    {
      status: 'received' as const,
      changedAt: receivedAt,
      actorType: 'public-submission' as const,
    },
  ],
}

function setup(current: ComplaintDocument = complaint) {
  const updated: ComplaintDocument = {
    ...current,
    status: 'actioned' as const,
    updatedAt: isoDateTime('2026-09-10T13:00:00.000Z'),
    statusHistory: [
      ...current.statusHistory,
      {
        status: 'actioned' as const,
        changedAt: isoDateTime('2026-09-10T13:00:00.000Z'),
        actorType: 'administrator' as const,
        actorId: 'admin-1',
      },
    ],
  }
  const collection = {
    find: vi.fn(() => ({
      sort: vi.fn(() => ({
        limit: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([current]) })),
      })),
    })),
    findOne: vi.fn().mockResolvedValue(current),
    findOneAndUpdate: vi.fn().mockResolvedValue(updated),
    insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
  }
  getConnectedDatabase.mockResolvedValue({
    collection: vi.fn().mockReturnValue(collection),
  })
  return { collection, updated }
}

function request(body: unknown) {
  return new Request(
    `http://localhost/api/v1/admin/complaints/${complaintId}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } })
})

describe('admin complaint routes', () => {
  it('returns complaint contacts only to administrators', async () => {
    const { collection } = setup()
    const response = await GET()

    expect(response.status).toBe(200)
    expect((await response.json()).complaints[0]).toMatchObject({
      id: complaintId,
      contact: complaint.contact,
      statusHistory: complaint.statusHistory,
    })
    expect(collection.find).toHaveBeenCalledWith({})
    expect(collection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'queue-viewed',
        actorId: 'admin-1',
        complaintIds: [complaintId],
      }),
    )
  })

  it('rejects unauthenticated and non-administrator queue access', async () => {
    getSession.mockResolvedValueOnce(null)
    expect((await GET()).status).toBe(401)

    getSession.mockResolvedValueOnce({ user: { id: 'user-1', role: 'user' } })
    expect((await GET()).status).toBe(403)
    expect(getConnectedDatabase).not.toHaveBeenCalled()
  })

  it('hides complaint queue storage and audit failures behind a retryable problem', async () => {
    getConnectedDatabase.mockRejectedValueOnce(
      new Error('database unavailable'),
    )

    const response = await GET()

    expect(response.status).toBe(503)
    expect(response.headers.get('content-type')).toContain(
      'application/problem+json',
    )
    expect(await response.json()).toEqual({
      type: 'https://platter.dev/problems/admin-complaint-queue-unavailable',
      title: 'Complaint queue temporarily unavailable',
      status: 503,
      detail:
        'The administrator complaint queue is temporarily unavailable. Try again shortly.',
      code: 'ADMIN_COMPLAINT_QUEUE_UNAVAILABLE',
    })

    const { collection } = setup()
    collection.insertOne.mockRejectedValueOnce(new Error('audit unavailable'))
    const auditResponse = await GET()

    expect(auditResponse.status).toBe(503)
    expect(JSON.stringify(await auditResponse.json())).not.toContain(
      'audit unavailable',
    )
  })

  it('hides malformed persisted complaint records behind a retryable problem', async () => {
    const { collection } = setup()
    collection.find.mockReturnValueOnce({
      sort: vi.fn(() => ({
        limit: vi.fn(() => ({
          toArray: vi
            .fn()
            .mockResolvedValue([{ ...complaint, status: 'not-a-status' }]),
        })),
      })),
    })

    const queueResponse = await GET()

    expect(queueResponse.status).toBe(503)
    expect(JSON.stringify(await queueResponse.json())).not.toContain(
      'not-a-status',
    )
    expect(collection.insertOne).not.toHaveBeenCalled()
  })

  it('records an administrator status transition with actor and history', async () => {
    const { collection, updated } = setup()
    const response = await PATCH(request({ status: 'actioned' }), {
      params: Promise.resolve({ complaintId }),
    })

    expect(response.status).toBe(200)
    expect((await response.json()).complaint.status).toBe('actioned')
    expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: complaintId, status: 'received' },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'actioned' }),
        $push: {
          statusHistory: expect.objectContaining({
            status: 'actioned',
            actorType: 'administrator',
            actorId: 'admin-1',
          }),
        },
      }),
      { returnDocument: 'after' },
    )
    expect(updated.statusHistory[1]).toMatchObject({ actorId: 'admin-1' })
    expect(collection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'status-changed',
        actorId: 'admin-1',
        complaintIds: [complaintId],
        fromStatus: 'received',
        toStatus: 'actioned',
      }),
    )
  })

  it('hides complaint update storage failures behind a retryable problem', async () => {
    getConnectedDatabase.mockRejectedValueOnce(
      new Error('database unavailable'),
    )

    const response = await PATCH(request({ status: 'actioned' }), {
      params: Promise.resolve({ complaintId }),
    })

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      type: 'https://platter.dev/problems/admin-complaint-storage-unavailable',
      code: 'ADMIN_COMPLAINT_STORAGE_UNAVAILABLE',
    })
  })

  it('hides malformed persisted complaint updates behind a retryable problem', async () => {
    const { collection } = setup()
    collection.findOne.mockResolvedValueOnce({
      ...complaint,
      status: 'not-a-status',
    })

    const response = await PATCH(request({ status: 'actioned' }), {
      params: Promise.resolve({ complaintId }),
    })

    expect(response.status).toBe(503)
    expect(collection.findOneAndUpdate).not.toHaveBeenCalled()
    expect(JSON.stringify(await response.json())).not.toContain('not-a-status')
  })

  it('validates IDs, statuses, and the complaint state machine', async () => {
    setup()
    expect(
      (
        await PATCH(
          new Request('http://localhost', {
            method: 'PATCH',
            body: JSON.stringify({ status: 'actioned' }),
          }),
          { params: Promise.resolve({ complaintId: 'not-an-id' }) },
        )
      ).status,
    ).toBe(404)

    expect(
      (
        await PATCH(request({ status: 'not-a-status' }), {
          params: Promise.resolve({ complaintId }),
        })
      ).status,
    ).toBe(422)

    const closed: ComplaintDocument = { ...complaint, status: 'closed' }
    const { collection } = setup(closed)
    expect(
      (
        await PATCH(request({ status: 'received' }), {
          params: Promise.resolve({ complaintId }),
        })
      ).status,
    ).toBe(409)
    expect(collection.findOneAndUpdate).not.toHaveBeenCalled()
  })
})
