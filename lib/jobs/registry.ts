import { z } from 'zod'
import { recipeImportIdempotencyKeySchema } from '@/lib/recipe-imports'

export const jobPayloads = {
  'recipe-import': z.object({
    importId: z.string().uuid(),
    userId: z.string().min(1),
    idempotencyKey: recipeImportIdempotencyKeySchema,
    operation: z
      .enum(['process', 'retry', 'reprocess'])
      .optional()
      .default('process'),
    jobGeneration: z.string().uuid().optional(),
  }),
  smoke: z.object({ attempt: z.number().int().nonnegative().default(0) }),
} as const

export type JobName = keyof typeof jobPayloads
export type JobPayload<N extends JobName> = z.infer<(typeof jobPayloads)[N]>
export type JobInput<N extends JobName> = z.input<(typeof jobPayloads)[N]>

export function validateJobPayload<N extends JobName>(
  name: N,
  payload: unknown,
): JobPayload<N> {
  return jobPayloads[name].parse(payload) as JobPayload<N>
}
