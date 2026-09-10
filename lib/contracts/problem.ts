import { z } from 'zod'

export const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  code: z.string(),
  fields: z.record(z.string(), z.array(z.string())).optional(),
})

export type Problem = z.infer<typeof problemSchema>

export function problemResponse(problem: Problem) {
  return Response.json(problem, {
    status: problem.status,
    headers: { 'content-type': 'application/problem+json' },
  })
}
