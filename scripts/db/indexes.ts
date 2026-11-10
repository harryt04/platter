import { ensureSharedIndexes } from '@/lib/db/indexes'
import { getConnectedDatabase, getMongoClient } from '@/lib/db/mongo-client'

async function main() {
  const db = await getConnectedDatabase()
  try {
    await ensureSharedIndexes(db)
    console.log(JSON.stringify({ script: 'db:indexes', status: 'ok' }))
  } finally {
    await getMongoClient().close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
