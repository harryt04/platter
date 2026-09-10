import { Agenda } from 'agenda'
import { MongoBackend } from '@agendajs/mongo-backend'
import type { Db } from 'mongodb'

export async function enqueueRecipeImport(
  db: Db,
  payload: {
    importId: string
    userId: string
    idempotencyKey: string
  },
) {
  const agenda = new Agenda({
    backend: new MongoBackend({ mongo: db }),
    name: 'platter-web-enqueuer',
  })
  const job = agenda.create('recipe-import', payload)
  job
    .unique(
      {
        'data.userId': payload.userId,
        'data.idempotencyKey': payload.idempotencyKey,
      },
      { insertOnly: true },
    )
    .schedule(new Date())
  await job.save()
}
