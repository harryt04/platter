import { Agenda } from 'agenda'
import { MongoBackend } from '@agendajs/mongo-backend'
import { getConnectedDatabase, getMongoClient } from '@/lib/db/mongo-client'
import { validateJobPayload } from '@/lib/jobs/registry'
import { isoDateTime } from '@/lib/contracts/ids'
import type { RecipeImportDocument } from '@/lib/recipe-imports'

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
  agenda.define('recipe-import', async (job) => {
    const payload = validateJobPayload('recipe-import', job.attrs.data)
    await db.collection<RecipeImportDocument>('recipe_imports').updateOne(
      {
        _id: payload.importId,
        status: { $in: ['queued', 'retrying'] },
      },
      { $set: { status: 'processing', updatedAt: isoDateTime(new Date()) } },
    )
    console.log(
      JSON.stringify({
        service: 'worker',
        job: 'recipe-import',
        importId: payload.importId,
        status: 'processing',
      }),
    )
  })

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
