import { MongoClient } from 'mongodb'
import { serverEnv } from '@/lib/env/server'

declare global {
  var platterMongoClient: MongoClient | undefined
}

export function getMongoClient() {
  if (!global.platterMongoClient) {
    global.platterMongoClient = new MongoClient(serverEnv().MONGODB_URI, {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    })
  }
  return global.platterMongoClient
}

export function getDatabase() {
  return getMongoClient().db(serverEnv().MONGODB_DATABASE)
}

export async function getConnectedDatabase() {
  const client = getMongoClient()
  await client.connect()
  return getDatabase()
}
