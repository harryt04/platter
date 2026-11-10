import { Agenda, backoffStrategies } from 'agenda'
import { MongoBackend } from '@agendajs/mongo-backend'
import { getConnectedDatabase, getMongoClient } from '@/lib/db/mongo-client'
import { validateJobPayload } from '@/lib/jobs/registry'
import {
  createRecipeImportJobHandler,
  recipeImportRetryPolicy,
} from '@/lib/recipe-import-worker'

async function main() {
  const db = await getConnectedDatabase()
  const agenda = new Agenda({
    backend: new MongoBackend({ mongo: db }),
    name: 'platter-worker',
    processEvery: '5 seconds',
    defaultConcurrency: 2,
    logging: true,
  })

  agenda.define('smoke', async (job) => {
    validateJobPayload('smoke', job.attrs.data ?? {})
    console.log(
      JSON.stringify({ service: 'worker', job: 'smoke', status: 'completed' }),
    )
  })
  agenda.define(
    'recipe-import',
    async (job) => {
      await createRecipeImportJobHandler(db)(job)
    },
    {
      backoff: backoffStrategies.exponential({
        delay: recipeImportRetryPolicy.initialDelayMs,
        maxDelay: recipeImportRetryPolicy.maxDelayMs,
        maxRetries: recipeImportRetryPolicy.maxRetries,
      }),
    },
  )

  await agenda.start()
  console.log(JSON.stringify({ service: 'worker', status: 'ready' }))

  const shutdown = async () => {
    await agenda.stop()
    await getMongoClient().close()
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      service: 'worker',
      status: 'error',
      message: String(error),
    }),
  )
  process.exitCode = 1
})
