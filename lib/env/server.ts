import { z } from 'zod'

const optionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional(),
)
const serverSchema = z.object({
  APP_URL: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/?replicaSet=rs0'),
  MONGODB_DATABASE: z.string().default('platter_development'),
  BETTER_AUTH_SECRET: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(16).optional(),
  ),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
  SMTP_ENABLED: z.coerce.boolean().default(false),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_FROM: z.string().default('noreply@example.test'),
  INVITATION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168),
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_SECURE: z.coerce.boolean().default(false),
  REALTIME_PORT: z.coerce.number().int().positive().default(3001),
  NEXT_PUBLIC_REALTIME_URL: z.string().url().default('http://localhost:3001'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  POSTHOG_ENABLED: z.coerce.boolean().default(false),
  NEXT_PUBLIC_POSTHOG_KEY: optionalString,
  NEXT_PUBLIC_POSTHOG_HOST: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().url().optional(),
  ),
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
})

export type ServerEnv = z.infer<typeof serverSchema>

let cached: ServerEnv | undefined

export function serverEnv(): ServerEnv {
  if (cached) return cached

  const parsed = serverSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${parsed.error.message}`)
  }
  if (
    parsed.data.NODE_ENV === 'production' &&
    !parsed.data.BETTER_AUTH_SECRET
  ) {
    throw new Error('Missing required environment variable: BETTER_AUTH_SECRET')
  }
  cached = parsed.data
  return cached
}

export function resetServerEnvForTests() {
  cached = undefined
}
