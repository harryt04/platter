import { createHash } from 'node:crypto'
import { getConnectedDatabase, getMongoClient } from '@/lib/db/mongo-client'

const name = 'foundation-001'
const checksum = createHash('sha256').update(name).digest('hex')

async function main() {
  const db = await getConnectedDatabase()
  try {
    const ledger = db.collection('migration_ledger')
    const existing = await ledger.findOne({ name })
    if (!existing)
      await ledger.insertOne({
        name,
        checksum,
        startedAt: new Date(),
        completedAt: new Date(),
        result: 'no-op foundation migration',
      })
    console.log(
      JSON.stringify({
        script: 'db:migrate',
        migration: name,
        status: existing ? 'already-applied' : 'applied',
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
