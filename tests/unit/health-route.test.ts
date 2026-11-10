import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/v1/health/route'

const { getConnectedDatabase } = vi.hoisted(() => ({
  getConnectedDatabase: vi.fn(),
}))

vi.mock('@/lib/db/mongo-client', () => ({ getConnectedDatabase }))

describe('GET /api/v1/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports the web service and MongoDB as ready', async () => {
    getConnectedDatabase.mockResolvedValue({
      command: vi.fn().mockResolvedValue({ ok: 1 }),
    })

    const response = await GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      status: 'ok',
      service: 'web',
      version: 'v1',
      dependencies: { mongodb: 'ok' },
    })
  })

  it('returns a retryable problem when MongoDB is unavailable', async () => {
    getConnectedDatabase.mockRejectedValue(new Error('connection reset'))

    const response = await GET()

    expect(response.status).toBe(503)
    expect(response.headers.get('content-type')).toContain(
      'application/problem+json',
    )
    expect(await response.json()).toEqual({
      type: 'https://platter.dev/problems/healthcheck-failed',
      title: 'Service unavailable',
      status: 503,
      detail: 'The web service cannot reach its database.',
      code: 'HEALTHCHECK_FAILED',
    })
  })

  it('reports MongoDB command failures as unavailable', async () => {
    getConnectedDatabase.mockResolvedValue({
      command: vi.fn().mockRejectedValue(new Error('ping failed')),
    })

    const response = await GET()

    expect(response.status).toBe(503)
  })
})
