import type { ServerWebSocket } from 'bun'
import { db } from '../db'
import { games } from '../db/schema'
import { eq } from 'drizzle-orm'
import {
  playAttack,
  playBlock,
  skipBlock,
  pass,
  resolveTurn,
  resupply,
  stateForPlayer,
  finishBout,
  startNextBout,
  ackBoutEnd,
  determineBoutWinnerOnPass,
} from '../game/engine'
import type { GameState, Player } from '../game/types'
import { opponent } from '../game/types'

type GameRow = typeof games.$inferSelect
type PlayerLabel = 'p1' | 'p2'

export type WsData = {
  gameId: string | null
  player: PlayerLabel | null
}

const connections = new Map<string, Map<PlayerLabel, ServerWebSocket<WsData>>>()
const boutTimers = new Map<string, ReturnType<typeof setTimeout>>()

const BOUT_ACK_TIMEOUT_MS = 30000

function scheduleBoutAutoAdvance(gameId: string) {
  clearBoutTimer(gameId)
  const timer = setTimeout(async () => {
    boutTimers.delete(gameId)
    const state = await loadGame(gameId)
    if (!state || state.turnPhase !== 'bout_end') return
    const next = startNextBout(state)
    await saveGame(next)
    broadcast(next)
  }, BOUT_ACK_TIMEOUT_MS)
  boutTimers.set(gameId, timer)
}

function clearBoutTimer(gameId: string) {
  const timer = boutTimers.get(gameId)
  if (timer) {
    clearTimeout(timer)
    boutTimers.delete(gameId)
  }
}

function parseGame(row: GameRow): GameState {
  return {
    id: row.id,
    status: row.status as GameState['status'],
    player1Id: row.player1Id,
    player2Id: row.player2Id,
    currentBout: row.currentBout,
    boutWinners: [row.bout1Winner, row.bout2Winner, row.bout3Winner],
    winner: row.winner,
    turnPlayer: row.turnPlayer as Player | null,
    turnPhase: row.turnPhase as GameState['turnPhase'],
    p1Hand: JSON.parse(row.p1Hand),
    p2Hand: JSON.parse(row.p2Hand),
    p1Cakes: row.p1Cakes,
    p2Cakes: row.p2Cakes,
    p1HandSize: row.p1HandSize,
    p2HandSize: row.p2HandSize,
    deck: JSON.parse(row.deck),
    discard: JSON.parse(row.discard),
    attackClaim: row.attackClaim ? JSON.parse(row.attackClaim) : null,
    blockClaim: row.blockClaim ? JSON.parse(row.blockClaim) : null,
    passedLast: row.passedLast as Player | null,
    boutEndAcks: JSON.parse(row.boutEndAcks),
  }
}

function setGameFields(state: GameState) {
  return {
    status: state.status,
    currentBout: state.currentBout,
    bout1Winner: state.boutWinners[0],
    bout2Winner: state.boutWinners[1],
    bout3Winner: state.boutWinners[2],
    winner: state.winner,
    turnPlayer: state.turnPlayer || null,
    turnPhase: state.turnPhase || null,
    p1Hand: JSON.stringify(state.p1Hand),
    p2Hand: JSON.stringify(state.p2Hand),
    p1Cakes: state.p1Cakes,
    p2Cakes: state.p2Cakes,
    p1HandSize: state.p1HandSize,
    p2HandSize: state.p2HandSize,
    deck: JSON.stringify(state.deck),
    discard: JSON.stringify(state.discard),
    attackClaim: state.attackClaim ? JSON.stringify(state.attackClaim) : null,
    blockClaim: state.blockClaim ? JSON.stringify(state.blockClaim) : null,
    passedLast: state.passedLast || null,
    boutEndAcks: JSON.stringify(state.boutEndAcks),
  }
}

async function loadGame(id: string): Promise<GameState | null> {
  const rows = await db.select().from(games).where(eq(games.id, id))
  if (rows.length === 0) return null
  return parseGame(rows[0]!)
}

async function saveGame(state: GameState) {
  await db.update(games).set(setGameFields(state)).where(eq(games.id, state.id))
}

function broadcast(state: GameState) {
  const gameConns = connections.get(state.id)
  if (!gameConns) return
  for (const [player, ws] of gameConns) {
    ws.send(JSON.stringify({ type: 'state', state: stateForPlayer(state, player) }))
  }
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

      let player: PlayerLabel
      if (msg.playerId === state.player1Id) {
        player = 'p1'
      } else if (msg.playerId === state.player2Id) {
        player = 'p2'
      } else {
        send(ws, { type: 'error', message: 'Not a player in this game' })
        return
      }

      ws.data.gameId = msg.gameId
      ws.data.player = player

      if (!connections.has(msg.gameId)) connections.set(msg.gameId, new Map())
      connections.get(msg.gameId)!.set(player, ws)

      send(ws, { type: 'state', state: stateForPlayer(state, player) })
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

    switch (msg.type) {
      case 'attack': {
        const result = playAttack(state, player, msg.cardIds, msg.claimedName)
        if (result.error) {
          send(ws, { type: 'error', message: result.error })
          return
        }
        await saveGame(result.state)
        broadcast(result.state)
        break
      }
      case 'block': {
        const result = playBlock(state, player, msg.cardIds)
        if (result.error) {
          send(ws, { type: 'error', message: result.error })
          return
        }
        await saveGame(result.state)
        broadcast(result.state)
        break
      }
      case 'skipBlock': {
        const result = skipBlock(state, player)
        if (result.error) {
          send(ws, { type: 'error', message: result.error })
          return
        }
        await saveGame(result.state)
        broadcast(result.state)
        break
      }
      case 'resolve': {
        const { state: resolved, boutOver, attackerWins } = resolveTurn(state)
        if (boutOver) {
          const boutWinner: Player = attackerWins
            ? (state.attackClaim!.player as Player)
            : (opponent(state.attackClaim!.player) as Player)
          const afterFinish = finishBout(resolved, boutWinner)
          await saveGame(afterFinish)
          broadcast(afterFinish)
          if (afterFinish.turnPhase === 'bout_end') {
            scheduleBoutAutoAdvance(gameId)
          }
        } else {
          const supplied = resupply(resolved)
          await saveGame(supplied)
          broadcast(supplied)
        }
        break
      }
      case 'pass': {
        const result = pass(state, player)
        if (result.error) {
          send(ws, { type: 'error', message: result.error })
          return
        }
        if (result.doublePass) {
          const boutWinner = determineBoutWinnerOnPass(result.state)
          const afterFinish = finishBout(result.state, boutWinner)
          await saveGame(afterFinish)
          broadcast(afterFinish)
          if (afterFinish.turnPhase === 'bout_end') {
            scheduleBoutAutoAdvance(gameId)
          }
        } else {
          await saveGame(result.state)
          broadcast(result.state)
        }
        break
      }
      case 'boutAck': {
        const ackResult = ackBoutEnd(state, player)
        if (ackResult.error) {
          send(ws, { type: 'error', message: ackResult.error })
          return
        }
        if (ackResult.bothAcked) {
          clearBoutTimer(gameId)
          const next = startNextBout(ackResult.state)
          await saveGame(next)
          broadcast(next)
        } else {
          await saveGame(ackResult.state)
          broadcast(ackResult.state)
        }
        break
      }
      default:
        send(ws, { type: 'error', message: `Unknown action: ${msg.type}` })
    }
  } catch (e: any) {
    send(ws, { type: 'error', message: e.message })
  }
}

export function wsClose(ws: ServerWebSocket<WsData>) {
  const { gameId, player } = ws.data
  if (gameId && player) {
    const gameConns = connections.get(gameId)
    if (gameConns) {
      gameConns.delete(player)
      if (gameConns.size === 0) connections.delete(gameId)
    }
  }
}
