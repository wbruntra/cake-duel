import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import gameRoutes from './src/routes/games'
import { wsOpen, wsMessage, wsClose, type WsData } from './src/routes/ws'

const app = new Hono()

app.use(logger())
app.use('/*', cors())

app.route('/', gameRoutes)

const server = Bun.serve<WsData>({
  port: process.env.PORT || 9001,
  fetch(req, server) {
    const url = new URL(req.url)
    if (url.pathname === '/ws') {
      const upgraded = server.upgrade(req, { data: { gameId: null, player: null } })
      if (upgraded) return undefined
      return new Response('WebSocket upgrade failed', { status: 400 })
    }
    return app.fetch(req)
  },
  websocket: {
    open: wsOpen,
    message: wsMessage,
    close: wsClose,
  },
})

console.log(`Server running on http://localhost:${server.port}`)
