import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/mongo-adapter'
import { auth } from '@/lib/auth/auth'
import { getConnectedDatabase, getMongoClient } from '@/lib/db/mongo-client'
import { serverEnv } from '@/lib/env/server'

const env = serverEnv()
const httpServer = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ status: 'ok', service: 'realtime' }))
    return
  }
  response.writeHead(404)
  response.end()
})

const io = new Server(httpServer, {
  cors: {
    origin: env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()),
    credentials: true,
  },
})

io.use(async (socket, next) => {
  try {
    const cookie = socket.handshake.headers.cookie
    if (!cookie) return next(new Error('AUTHENTICATION_REQUIRED'))
    const session = await auth.api.getSession({
      headers: new Headers({ cookie }),
    })
    if (!session) return next(new Error('AUTHENTICATION_REQUIRED'))
    socket.data.userId = session.user.id
    next()
  } catch {
    next(new Error('AUTHENTICATION_UNAVAILABLE'))
  }
})

io.on('connection', (socket) => {
  socket.on('foundation:join', (listId: string) => {
    if (!['family', 'personal'].includes(listId))
      return socket.emit('foundation:error', { code: 'LIST_ACCESS_DENIED' })
    socket.join(`list:${listId}`)
    socket.emit('foundation:smoke', { revision: Date.now(), listId })
  })
})

async function main() {
  const db = await getConnectedDatabase()
  const adapterEvents = db.collection('socket.io-adapter-events')
  await adapterEvents.createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 86_400 },
  )
  io.adapter(createAdapter(adapterEvents))
  httpServer.listen(env.REALTIME_PORT, () => {
    console.log(
      JSON.stringify({
        service: 'realtime',
        port: env.REALTIME_PORT,
        status: 'ready',
      }),
    )
  })
}

async function shutdown() {
  io.close()
  httpServer.close()
  await getMongoClient().close()
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      service: 'realtime',
      status: 'error',
      message: String(error),
    }),
  )
  process.exitCode = 1
})
