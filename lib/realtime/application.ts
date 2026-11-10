import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import {
  authenticateRealtimeSocket,
  joinAuthenticatedUserRoom,
  joinAuthorizedRealtimeRoom,
  type RealtimeMembershipReader,
  type RealtimeSessionReader,
} from '@/lib/realtime/rooms'

type RealtimeApplicationOptions = {
  readSession: RealtimeSessionReader
  readMembership?: RealtimeMembershipReader
  allowedOrigins?: string[]
}

/**
 * Create the Socket.IO boundary separately from process startup so connected
 * client behavior can be exercised with real sockets without a Mongo adapter.
 */
export function createRealtimeApplication(
  httpServer: HttpServer,
  {
    readSession,
    readMembership,
    allowedOrigins = ['http://localhost:3000'],
  }: RealtimeApplicationOptions,
) {
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  })

  io.use(async (socket, next) => {
    try {
      socket.data.userId = await authenticateRealtimeSocket(socket, readSession)
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
          const userId = await authenticateRealtimeSocket(socket, readSession)
          if (userId !== socket.data.userId) {
            socket.emit('foundation:error', {
              code: 'AUTHENTICATION_REQUIRED',
            })
            return
          }
          await joinAuthorizedRealtimeRoom(
            socket,
            listId,
            userId,
            readMembership,
          )
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

  return io
}
