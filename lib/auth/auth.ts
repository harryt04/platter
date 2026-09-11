import { betterAuth } from 'better-auth'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { nextCookies } from 'better-auth/next-js'
import { getDatabase } from '@/lib/db/mongo-client'
import { serverEnv } from '@/lib/env/server'
import { sendPasswordResetEmail } from '@/lib/auth/mailer'

const env = serverEnv()

export const auth = betterAuth({
  appName: 'Platter',
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET ?? 'development-only-platter-secret-change-me',
  database: mongodbAdapter(getDatabase(), { usePlural: true }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, url)
    },
  },
  user: {
    additionalFields: {
      role: { type: 'string', required: false, defaultValue: 'user' },
      locale: { type: 'string', required: false, defaultValue: 'en-US' },
    },
  },
  plugins: [nextCookies()],
})
