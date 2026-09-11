import { betterAuth } from 'better-auth'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { nextCookies } from 'better-auth/next-js'
import { getDatabase } from '@/lib/db/mongo-client'
import { serverEnv } from '@/lib/env/server'
import { sendPasswordResetEmail } from '@/lib/auth/mailer'
import {
  anonymizePublicImportedAccountContent,
  completeAccountDeletionAudit,
  deletePrivateAccountContent,
  getAccountDeletionOwnershipBlockers,
  getAccountDeletionImpact,
  recordAccountDeletionPreparedAudit,
  removeAccountMembershipAndPrivateArtifacts,
} from '@/lib/account-deletion'
import { getConnectedDatabase } from '@/lib/db/mongo-client'

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
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        const db = await getConnectedDatabase()
        const blockers = await getAccountDeletionOwnershipBlockers(db, user.id)
        if (blockers.length > 0) {
          throw new Error('ACCOUNT_DELETION_OWNERSHIP_BLOCKED')
        }
        const impact = await getAccountDeletionImpact(db, user.id)
        const privateCleanup = await deletePrivateAccountContent(db, user.id)
        const publicCleanup = await anonymizePublicImportedAccountContent(
          db,
          user.id,
        )
        await recordAccountDeletionPreparedAudit(db, user.id, {
          ownedLists: impact.ownedLists,
          coOwnedLists: impact.ownedLists - impact.soleOwnerLists.length,
          memberships: impact.memberships,
          manuallyAuthoredRecipes: impact.manuallyAuthoredRecipes,
          publicImportedRecipes: impact.publicImportedRecipes,
          completedShoppingRuns: impact.completedShoppingRuns,
          ...privateCleanup,
          ...publicCleanup,
        })
      },
      afterDelete: async (user) => {
        const db = await getConnectedDatabase()
        await removeAccountMembershipAndPrivateArtifacts(db, user.id)
        await completeAccountDeletionAudit(db, user.id)
      },
    },
  },
  plugins: [nextCookies()],
})
