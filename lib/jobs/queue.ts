import { Agenda } from 'agenda'
import { MongoBackend } from '@agendajs/mongo-backend'
import type { Db } from 'mongodb'

export async function enqueueRecipeImport(
  db: Db,
  importId: string,
  sourceUrl: string,
) {
  const agenda = new Agenda({
    backend: new MongoBackend({ mongo: db }),
    name: 'platter-web-enqueuer',
  })
  await agenda.now('recipe-import', { importId, sourceUrl })
}
