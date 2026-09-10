import { Agenda } from 'agenda'
import { MongoBackend } from '@agendajs/mongo-backend'
import type { Db } from 'mongodb'
import type { JobInput } from '@/lib/jobs/registry'

export async function enqueueRecipeImport(
  db: Db,
  payload: JobInput<'recipe-import'>,
) {
  const agenda = new Agenda({
    backend: new MongoBackend({ mongo: db }),
    name: 'platter-web-enqueuer',
  })
  const job = agenda.create('recipe-import', payload)
  const uniqueJobKey = payload.jobGeneration
    ? {
        'data.userId': payload.userId,
        'data.importId': payload.importId,
        'data.jobGeneration': payload.jobGeneration,
      }
    : {
        'data.userId': payload.userId,
        'data.importId': payload.importId,
        'data.idempotencyKey': payload.idempotencyKey,
        'data.operation': payload.operation ?? 'process',
      }
  job.unique(uniqueJobKey, { insertOnly: true }).schedule(new Date())
  await job.save()
}
