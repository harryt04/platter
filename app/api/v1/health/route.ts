import { problemResponse } from '@/lib/contracts/problem'
import { getConnectedDatabase } from '@/lib/db/mongo-client'

export async function GET() {
  try {
    const database = await getConnectedDatabase()
    await database.command({ ping: 1 })
    return Response.json({
      status: 'ok',
      service: 'web',
      version: 'v1',
      dependencies: { mongodb: 'ok' },
    })
  } catch {
    return problemResponse({
      type: 'https://platter.dev/problems/healthcheck-failed',
      title: 'Service unavailable',
      status: 503,
      detail: 'The web service cannot reach its database.',
      code: 'HEALTHCHECK_FAILED',
    })
  }
}
export async function POST() {
  return problemResponse({
    type: 'https://platter.dev/problems/not-implemented',
    title: 'Not implemented',
    status: 501,
    detail: 'This foundation endpoint is reserved for feature-owned mutations.',
    code: 'NOT_IMPLEMENTED',
  })
}
