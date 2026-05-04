import type { ServerWebSocket } from 'bun'
import type { GameState, Player } from '../game/types'
import { stateForPlayer } from '../game/engine'

type PlayerLabel = 'p1' | 'p2'

const connections = new Map<string, Map<PlayerLabel, ServerWebSocket<any>>>()

export function registerConnection(gameId: string, player: PlayerLabel, ws: ServerWebSocket<any>) {
  if (!connections.has(gameId)) connections.set(gameId, new Map())
  connections.get(gameId)!.set(player, ws)
}

export function unregisterConnection(gameId: string, player: PlayerLabel) {
  const gameConns = connections.get(gameId)
  if (gameConns) {
    gameConns.delete(player)
    if (gameConns.size === 0) connections.delete(gameId)
  }
}

export function broadcast(state: GameState) {
  const gameConns = connections.get(state.id)
  if (!gameConns) return
  for (const [player, ws] of gameConns) {
    ws.send(JSON.stringify({ type: 'state', state: stateForPlayer(state, player) }))
  }
}
