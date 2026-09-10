import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/mongo-adapter'
import { auth } from '@/lib/auth/auth'
import { getConnectedDatabase, getMongoClient } from '@/lib/db/mongo-client'
import {
  authenticateRealtimeSocket,
  joinAuthenticatedUserRoom,
  joinAuthorizedRealtimeRoom,
} from '@/lib/realtime/rooms'
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
    socket.data.userId = await authenticateRealtimeSocket(socket, (headers) =>
      auth.api.getSession({ headers }),
    )
    next()
  } catch (error) {
    next(
      new Error(
        error instanceof Error && error.message === 'AUTHENTICATION_REQUIRED'
          ? 'AUTHENTICATION_REQUIRED'
          : 'AUTHENTICATION_UNAVAILABLE',
      ),
    )
  }
})

io.on('connection', (socket) => {
  void joinAuthenticatedUserRoom(socket, socket.data.userId)
  socket.on('foundation:join', (listId: unknown) => {
    void (async () => {
      try {
        const userId = await authenticateRealtimeSocket(socket, (headers) =>
          auth.api.getSession({ headers }),
        )
        if (userId !== socket.data.userId) {
          socket.emit('foundation:error', {
            code: 'AUTHENTICATION_REQUIRED',
          })
          return
        }
        await joinAuthorizedRealtimeRoom(socket, listId, userId)
      } catch (error) {
        socket.emit('foundation:error', {
          code:
            error instanceof Error &&
            error.message === 'AUTHENTICATION_REQUIRED'
              ? 'AUTHENTICATION_REQUIRED'
              : 'AUTHENTICATION_UNAVAILABLE',
        })
      }
    })()
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
