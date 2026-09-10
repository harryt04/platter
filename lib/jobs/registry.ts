import { z } from 'zod'

export const jobPayloads = {
  'recipe-import': z.object({
    recipeId: z.string(),
    sourceUrl: z.string().url(),
  }),
  smoke: z.object({ attempt: z.number().int().nonnegative().default(0) }),
} as const

export type JobName = keyof typeof jobPayloads
export type JobPayload<N extends JobName> = z.infer<(typeof jobPayloads)[N]>

export function validateJobPayload<N extends JobName>(
  name: N,
  payload: unknown,
): JobPayload<N> {
  return jobPayloads[name].parse(payload) as JobPayload<N>
}
