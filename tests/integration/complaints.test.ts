import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Db } from 'mongodb'
import { GET as getAdminComplaints } from '@/app/api/v1/admin/complaints/route'
import { PATCH as updateAdminComplaint } from '@/app/api/v1/admin/complaints/[complaintId]/route'
import { POST as submitComplaint } from '@/app/api/v1/complaints/route'
import { getConnectedDatabase, getMongoClient } from '@/lib/db/mongo-client'
import type {
  ComplaintAuditDocument,
  ComplaintDocument,
} from '@/lib/complaints'

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }))

vi.mock('@/lib/auth/authorization', () => ({ getSession }))

const databaseName = process.env.MONGODB_DATABASE ?? ''
const fixtureToken = `plattercomplaintintegration${Date.now()}`
const fixtureIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`
const sourceUrl = `https://complaints-${fixtureToken}.test/recipe`
const adminId = `${fixtureToken}-admin`

function publicRequest(body: unknown, ip = fixtureIp) {
  return new Request('http://localhost/api/v1/complaints', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  })
}

function complaintBody(overrides: Record<string, unknown> = {}) {
  return {
    type: 'copyright',
    sourceUrl,
    description: `${fixtureToken} public-content report`,
    contactName: 'Synthetic rights holder',
    contactEmail: `${fixtureToken}@example.test`,
    ...overrides,
  }
}

function adminPatchRequest(complaintId: string, body: unknown) {
  return updateAdminComplaint(
    new Request(`http://localhost/api/v1/admin/complaints/${complaintId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ complaintId }) },
  )
}

describe('Mongo-backed public-content complaint workflow', () => {
  let db: Db

  beforeAll(async () => {
    if (!/(?:^|_)(?:test|ci)(?:_|$)/.test(databaseName)) {
      throw new Error(
        'Integration tests require MONGODB_DATABASE to contain test or ci; refusing to write to a development database.',
      )
    }
    db = await getConnectedDatabase()
  })

  afterAll(async () => {
    if (!db) return
    await db.collection<ComplaintDocument>('complaints').deleteMany({
      sourceUrl: { $regex: fixtureToken },
    })
    await db
      .collection<ComplaintAuditDocument>('complaint_access_audit')
      .deleteMany({ actorId: adminId })
    await getMongoClient().close()
  })

  it('keeps public receipts restricted while retaining submitted contacts privately', async () => {
    const response = await submitComplaint(publicRequest(complaintBody()))
    expect(response.status).toBe(201)
    const body = await response.json()

    expect(body.complaint).toMatchObject({ status: 'received' })
    expect(body.complaint).not.toHaveProperty('contact')

    const stored = await db
      .collection<ComplaintDocument>('complaints')
      .findOne({ sourceUrl })
    expect(stored?.contact).toEqual({
      name: 'Synthetic rights holder',
      email: `${fixtureToken}@example.test`,
    })
  })

  it('validates reports and rate-limits repeated public submissions', async () => {
    const invalid = await submitComplaint(
      publicRequest(
        { type: 'copyright', description: '' },
        `${fixtureIp}-invalid`,
      ),
    )
    expect(invalid.status).toBe(422)

    const rateLimitIp = `${fixtureIp}-rate-limit`
    for (let index = 0; index < 5; index += 1) {
      const response = await submitComplaint(
        publicRequest(
          complaintBody({ sourceUrl: `${sourceUrl}/${index}` }),
          rateLimitIp,
        ),
      )
      expect(response.status).toBe(201)
    }

    const limited = await submitComplaint(
      publicRequest(
        complaintBody({ sourceUrl: `${sourceUrl}/limited` }),
        rateLimitIp,
      ),
    )
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBeTruthy()
  })

  it('restricts the complaint queue and audits metadata-only administrator access', async () => {
    getSession.mockResolvedValueOnce(null)
    expect((await getAdminComplaints()).status).toBe(401)

    getSession.mockResolvedValueOnce({
      user: { id: 'regular-user', role: 'user' },
    })
    expect((await getAdminComplaints()).status).toBe(403)

    getSession.mockResolvedValue({ user: { id: adminId, role: 'admin' } })
    const queue = await getAdminComplaints()
    expect(queue.status).toBe(200)
    const queueBody = await queue.json()
    const complaint = queueBody.complaints.find(
      (candidate: { sourceUrl?: string }) => candidate.sourceUrl === sourceUrl,
    )
    expect(complaint).toMatchObject({
      contact: {
        email: `${fixtureToken}@example.test`,
      },
    })

    const audit = await db
      .collection<ComplaintAuditDocument>('complaint_access_audit')
      .find({ actorId: adminId })
      .sort({ occurredAt: -1 })
      .toArray()
    expect(audit[0]).toMatchObject({
      action: 'queue-viewed',
      actorId: adminId,
    })
    expect(audit[0]).not.toHaveProperty('contact')
    expect(audit[0]).not.toHaveProperty('description')
    expect(audit[0]).not.toHaveProperty('sourceUrl')

    const complaintId = complaint.id as string
    const update = await adminPatchRequest(complaintId, { status: 'actioned' })
    expect(update.status).toBe(200)
    expect((await update.json()).complaint.status).toBe('actioned')

    const updated = await db
      .collection<ComplaintDocument>('complaints')
      .findOne({ _id: complaintId })
    expect(updated?.statusHistory.at(-1)).toMatchObject({
      status: 'actioned',
      actorType: 'administrator',
      actorId: adminId,
    })

    const transitionAudit = await db
      .collection<ComplaintAuditDocument>('complaint_access_audit')
      .findOne({ actorId: adminId, action: 'status-changed' })
    expect(transitionAudit).toMatchObject({
      complaintIds: [complaintId],
      fromStatus: 'received',
      toStatus: 'actioned',
    })

    getSession.mockResolvedValueOnce({
      user: { id: 'regular-user', role: 'user' },
    })
    expect(
      (await adminPatchRequest(complaintId, { status: 'closed' })).status,
    ).toBe(403)
  })
})
