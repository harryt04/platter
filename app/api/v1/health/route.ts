import { problemResponse } from '@/lib/contracts/problem'
export async function GET() {
  return Response.json({ status: 'ok', service: 'web', version: 'v1' })
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
