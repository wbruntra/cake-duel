import type { ServerWebSocket } from 'bun'
import { stateForPlayer } from '../game/engine'
import { loadGame } from '../db/game-store'
import { registerConnection, unregisterConnection, broadcast } from '../services/connections'
import { handleMove } from '../services/game'

export type WsData = {
  gameId: string | null
  player: 'p1' | 'p2' | null
}

function send(ws: ServerWebSocket<WsData>, msg: object) {
  ws.send(JSON.stringify(msg))
}

export function wsOpen(ws: ServerWebSocket<WsData>) {
  send(ws, { type: 'connected' })
}

export async function wsMessage(ws: ServerWebSocket<WsData>, rawMessage: string | Buffer) {
  try {
    const msg = JSON.parse(typeof rawMessage === 'string' ? rawMessage : rawMessage.toString())

    if (msg.type === 'join') {
      const state = await loadGame(msg.gameId)
      if (!state) {
        send(ws, { type: 'error', message: 'Game not found' })
        return
      }

      let player: 'p1' | 'p2'
      if (msg.playerId === state.player1Id) player = 'p1'
      else if (msg.playerId === state.player2Id) player = 'p2'
      else {
        send(ws, { type: 'error', message: 'Not a player in this game' })
        return
      }

      ws.data.gameId = msg.gameId
      ws.data.player = player
      registerConnection(msg.gameId, player, ws)
      send(ws, { type: 'state', state: stateForPlayer(state, player) })
      broadcast(state)
      return
    }

    const { gameId, player } = ws.data
    if (!gameId || !player) {
      send(ws, { type: 'error', message: 'Not joined' })
      return
    }

    const state = await loadGame(gameId)
    if (!state) {
      send(ws, { type: 'error', message: 'Game not found' })
      return
    }

    const result = await handleMove(gameId, state, player, msg)
    if ('error' in result) send(ws, { type: 'error', message: result.error })
  } catch (e: any) {
    send(ws, { type: 'error', message: e.message })
  }
}

export function wsClose(ws: ServerWebSocket<WsData>) {
  const { gameId, player } = ws.data
  if (gameId && player) unregisterConnection(gameId, player)
}
