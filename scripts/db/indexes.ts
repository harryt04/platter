import { ensureSharedIndexes } from '@/lib/db/indexes'
import { getConnectedDatabase, getMongoClient } from '@/lib/db/mongo-client'

const db = await getConnectedDatabase()
await ensureSharedIndexes(db)
console.log(JSON.stringify({ script: 'db:indexes', status: 'ok' }))
await getMongoClient().close()
