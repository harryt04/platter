import { auth } from '@/lib/auth/auth'
import { getMongoClient } from '@/lib/db/mongo-client'

const email = process.env.E2E_USER_EMAIL ?? 'ai-test-user@localhost.test'
const name = process.env.E2E_USER_NAME ?? 'AI test user'
const password = process.env.E2E_USER_PASSWORD

async function main() {
  if (!password)
    throw new Error(
      'Missing E2E_USER_PASSWORD in .env.test.local or CI environment',
    )
  try {
    const result = await auth.api.signUpEmail({
      body: { email, name, password },
    })
    const error = 'error' in result ? result.error : undefined
    const errorMessage = error ? String(error) : undefined
    if (errorMessage && !errorMessage.toLowerCase().includes('already'))
      throw new Error(errorMessage)
    console.log(
      JSON.stringify({
        script: 'db:seed:test-user',
        email,
        status: error ? 'already-present' : 'created',
      }),
    )
  } finally {
    await getMongoClient().close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
