import { Hono } from 'hono'
import { db } from '../db'
import { games } from '../db/schema'
import { eq } from 'drizzle-orm'
import {
  newBout,
  playAttack,
  playBlock,
  skipBlock,
  pass,
  resolveTurn,
  stateForPlayer,
  finishBout,
  startNextBout,
  resolveChallenge,
  toChallengeResult,
  toTurnResolution,
  determineBoutWinnerOnPass,
} from '../game/engine'
import type { GameState, Player } from '../game/types'
import { getAIMove } from '../ai/llm-player'
import {
  broadcast,
  loadGame,
  saveGame,
  scheduleTurnResolutionAutoAdvance,
  scheduleBoutAutoAdvance,
  scheduleChallengeAutoAdvance,
  clearChallengeTimer,
} from './ws'

function generateId(): string {
  return Math.random().toString(36).substring(2, 10)
}

function parseGameRow(row: any): GameState {
  return {
    id: row.id,
    status: row.status,
    player1Id: row.player1Id,
    player1Name: row.player1Name,
    player2Id: row.player2Id,
    player2Name: row.player2Name,
    currentBout: row.currentBout,
    boutWinners: [row.bout1Winner, row.bout2Winner, row.bout3Winner],
    winner: row.winner,
    turnPlayer: row.turnPlayer,
    turnPhase: row.turnPhase,
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
    passedLast: row.passedLast,
    boutEndAcks: JSON.parse(row.boutEndAcks || '[]'),
    challengeResult: row.challengeResult ? JSON.parse(row.challengeResult) : null,
    challengeAcks: JSON.parse(row.challengeAcks || '[]'),
    lastTurnResult: row.lastTurnResult ? JSON.parse(row.lastTurnResult) : null,
    turnAcks: JSON.parse(row.turnAcks || '[]'),
  }
}

function serializeGameState(state: GameState) {
  return {
    status: state.status,
    player1Id: state.player1Id,
    player1Name: state.player1Name,
    player2Id: state.player2Id,
    player2Name: state.player2Name,
    currentBout: state.currentBout,
    bout1Winner: state.boutWinners[0],
    bout2Winner: state.boutWinners[1],
    bout3Winner: state.boutWinners[2],
    winner: state.winner,
    turnPlayer: state.turnPlayer,
    turnPhase: state.turnPhase,
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
    passedLast: state.passedLast,
    boutEndAcks: JSON.stringify(state.boutEndAcks),
    challengeResult: state.challengeResult ? JSON.stringify(state.challengeResult) : null,
    challengeAcks: JSON.stringify(state.challengeAcks),
    lastTurnResult: state.lastTurnResult ? JSON.stringify(state.lastTurnResult) : null,
    turnAcks: JSON.stringify(state.turnAcks),
  }
}

const app = new Hono()

app.post('/api/games', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const playerId = generateId()
  const gameId = generateId()
  const playerName = (body.name || '').trim().slice(0, 20) || 'Player 1'

  const gameState: GameState = {
    id: gameId,
    status: 'waiting',
    player1Id: playerId,
    player1Name: playerName,
    player2Id: null,
    player2Name: null,
    currentBout: 1,
    boutWinners: [null, null, null],
    winner: null,
    turnPlayer: null,
    turnPhase: null,
    p1Hand: [],
    p2Hand: [],
    p1Cakes: 3,
    p2Cakes: 4,
    p1HandSize: 4,
    p2HandSize: 4,
    deck: [],
    discard: [],
    attackClaim: null,
    blockClaim: null,
    passedLast: null,
    boutEndAcks: [],
    challengeResult: null,
    challengeAcks: [],
    lastTurnResult: null,
    turnAcks: [],
  }

  await db.insert(games).values({
    id: gameId,
    createdAt: new Date().toISOString(),
    ...serializeGameState(gameState),
  })

  return c.json({ gameId, playerId })
})

app.post('/api/games/:id/join', async (c) => {
  const gameId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))

  const rows = await db.select().from(games).where(eq(games.id, gameId))
  if (rows.length === 0) return c.json({ error: 'Game not found' }, 404)

  const row = rows[0]!
  if (row.status !== 'waiting') return c.json({ error: 'Game not joinable' }, 400)

  const playerId = generateId()
  const playerName = (body.name || '').trim().slice(0, 20) || 'Player 2'
  const gameState = parseGameRow(row)

  const startedState = newBout(gameState, 'p1')
  startedState.player2Id = playerId
  startedState.player2Name = playerName

  await db.update(games).set(serializeGameState(startedState)).where(eq(games.id, gameId))

  return c.json({ gameId, playerId })
})

app.get('/api/games/:id', async (c) => {
  const gameId = c.req.param('id')
  const playerId = c.req.query('player')

  const rows = await db.select().from(games).where(eq(games.id, gameId))
  if (rows.length === 0) return c.json({ error: 'Game not found' }, 404)

  const row = rows[0]!
  const gameState = parseGameRow(row)

  if (!playerId) return c.json({ error: 'player query param required' }, 400)

  const player: Player = row.player1Id === playerId ? 'p1' : 'p2'
  if (row.player1Id !== playerId && row.player2Id !== playerId) {
    return c.json({ error: 'Not in this game' }, 403)
  }

  const visibleState = stateForPlayer(gameState, player)
  return c.json(visibleState)
})

app.post('/api/games/:id/ai-move', async (c) => {
  const gameId = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const playerId: string = body.playerId

  if (!playerId) return c.json({ error: 'playerId required' }, 400)

  const state = await loadGame(gameId)
  if (!state) return c.json({ error: 'Game not found' }, 404)
  if (state.status !== 'playing') return c.json({ error: 'Game not active' }, 400)

  const player: Player =
    state.player1Id === playerId ? 'p1' : state.player2Id === playerId ? 'p2' : null!
  if (!player) return c.json({ error: 'Not a player in this game' }, 403)

  if (state.turnPlayer !== player) {
    return c.json({ error: 'Not your turn' }, 400)
  }

  let move: Record<string, unknown>
  try {
    move = await getAIMove(state, player)
  } catch (e: any) {
    return c.json({ error: `AI error: ${e.message}` }, 500)
  }

  const type = move.type as string

  if (type === 'attack') {
    const result = playAttack(state, player, move.cardIds as string[], move.claimedName as string)
    if (result.error) return c.json({ error: result.error }, 400)
    clearChallengeTimer(gameId)
    await saveGame(result.state)
    broadcast(result.state)
    return c.json({ ok: true, move })
  }

  if (type === 'pass') {
    const result = pass(state, player)
    if (result.error) return c.json({ error: result.error }, 400)
    if (result.doublePass) {
      const boutWinner = determineBoutWinnerOnPass(result.state)
      const afterFinish = finishBout(result.state, boutWinner)
      await saveGame(afterFinish)
      broadcast(afterFinish)
      if (afterFinish.turnPhase === 'bout_end') scheduleBoutAutoAdvance(gameId)
    } else {
      await saveGame(result.state)
      broadcast(result.state)
    }
    return c.json({ ok: true, move })
  }

  if (type === 'block') {
    const result = playBlock(state, player, move.cardIds as string[])
    if (result.error) return c.json({ error: result.error }, 400)
    await saveGame(result.state)
    broadcast(result.state)
    return c.json({ ok: true, move })
  }

  if (type === 'skipBlock') {
    const result = skipBlock(state, player)
    if (result.error) return c.json({ error: result.error }, 400)
    await saveGame(result.state)
    broadcast(result.state)
    return c.json({ ok: true, move })
  }

  if (type === 'resolve') {
    const { state: resolved, turnResult } = resolveTurn(state)
    const next = toTurnResolution(resolved, turnResult)
    await saveGame(next)
    broadcast(next)
    scheduleTurnResolutionAutoAdvance(gameId)
    return c.json({ ok: true, move })
  }

  if (type === 'challenge') {
    const target = move.target as 'attack' | 'block'
    if (target !== 'attack' && target !== 'block') {
      return c.json({ error: 'Invalid challenge target' }, 400)
    }
    const result = resolveChallenge(state, player, target)
    if ('error' in result) return c.json({ error: result.error }, 400)
    const challengeState = toChallengeResult(result.state, result.challengeResult)
    await saveGame(challengeState)
    broadcast(challengeState)
    scheduleChallengeAutoAdvance(gameId)
    return c.json({ ok: true, move })
  }

  return c.json({ error: `Unknown move type: ${type}` }, 400)
})

export default app
