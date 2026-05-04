import { Hono } from 'hono'
import { db } from '../db'
import { games } from '../db/schema'
import { eq } from 'drizzle-orm'
import { newBout, stateForPlayer } from '../game/engine'
import type { GameState, Player } from '../game/types'
import { getAIMove } from '../ai/llm-player'
import { getCPUMove } from '../ai/cpu-player'
import type { MCTSDifficulty } from '../ai/mcts/types'
import { loadGame, saveGame, appendEvent } from '../db/game-store'
import { broadcast } from '../services/connections'
import { handleMove } from '../services/game'
import { scheduleCPUMoves } from '../services/cpu-player'

function generateId(): string {
  return Math.random().toString(36).substring(2, 10)
}

const CPU_DIFFICULTIES: MCTSDifficulty[] = ['easy', 'medium', 'hard']
const CPU_NAMES: Record<MCTSDifficulty, string> = {
  easy: 'CPU (Easy)',
  training: 'CPU (Easy)',
  medium: 'CPU (Medium)',
  hard: 'CPU (Hard)',
}

const app = new Hono()

app.post('/api/games', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const playerId = generateId()
  const gameId = generateId()
  const playerName = (body.name || '').trim().slice(0, 20) || 'Player 1'

  const cpuDifficulty: MCTSDifficulty | null =
    body.cpuDifficulty && CPU_DIFFICULTIES.includes(body.cpuDifficulty) ? body.cpuDifficulty : null

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
    p1Discard: [],
    p2Discard: [],
    attackClaim: null,
    blockClaim: null,
    passedLast: null,
    boutEndAcks: [],
    challengeResult: null,
    challengeAcks: [],
    lastTurnResult: null,
    turnAcks: [],
    lastAction: null,
    cpuPlayer: null,
    cpuDifficulty: null,
  }

  if (cpuDifficulty) {
    const cpuPlayerId = generateId()
    gameState.player2Id = cpuPlayerId
    gameState.player2Name = CPU_NAMES[cpuDifficulty]
    gameState.cpuPlayer = 'p2'
    gameState.cpuDifficulty = cpuDifficulty

    const startedState = newBout(gameState, 'p1')
    startedState.player2Id = cpuPlayerId
    startedState.player2Name = CPU_NAMES[cpuDifficulty]

    await db.insert(games).values({
      id: gameId,
      createdAt: new Date().toISOString(),
      status: startedState.status,
      player1Id: startedState.player1Id,
      player1Name: startedState.player1Name,
      player2Id: startedState.player2Id,
      player2Name: startedState.player2Name,
      currentBout: startedState.currentBout,
      p1Cakes: startedState.p1Cakes,
      p2Cakes: startedState.p2Cakes,
      p1HandSize: startedState.p1HandSize,
      p2HandSize: startedState.p2HandSize,
      cpuPlayer: startedState.cpuPlayer,
      cpuDifficulty: startedState.cpuDifficulty,
    })

    await saveGame(startedState)
    await appendEvent(gameId, null, 'game_start', {
      player1: startedState.player1Name,
      player2: startedState.player2Name,
      cpu: true,
      cpuDifficulty,
    })

    scheduleCPUMoves(gameId)

    return c.json({ gameId, playerId, cpu: true })
  }

  await db.insert(games).values({
    id: gameId,
    createdAt: new Date().toISOString(),
    status: gameState.status,
    player1Id: gameState.player1Id,
    player1Name: gameState.player1Name,
    player2Id: null,
    player2Name: null,
    currentBout: gameState.currentBout,
    p1Cakes: gameState.p1Cakes,
    p2Cakes: gameState.p2Cakes,
    p1HandSize: gameState.p1HandSize,
    p2HandSize: gameState.p2HandSize,
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
  if (row.cpuPlayer) return c.json({ error: 'Game has CPU opponent' }, 400)

  const playerId = generateId()
  const playerName = (body.name || '').trim().slice(0, 20) || 'Player 2'
  const gameState = await loadGame(gameId)
  if (!gameState) return c.json({ error: 'Game not found' }, 404)

  const startedState = newBout(gameState, 'p1')
  startedState.player2Id = playerId
  startedState.player2Name = playerName

  await saveGame(startedState)
  await appendEvent(gameId, null, 'game_start', {
    player1: startedState.player1Name,
    player2: startedState.player2Name,
  })

  return c.json({ gameId, playerId })
})

app.get('/api/games/:id', async (c) => {
  const gameId = c.req.param('id')
  const playerId = c.req.query('player')
  if (!playerId) return c.json({ error: 'player query param required' }, 400)

  const rows = await db.select().from(games).where(eq(games.id, gameId))
  if (rows.length === 0) return c.json({ error: 'Game not found' }, 404)

  const row = rows[0]!
  if (row.player1Id !== playerId && row.player2Id !== playerId) {
    return c.json({ error: 'Not in this game' }, 403)
  }

  const state = await loadGame(gameId)
  if (!state) return c.json({ error: 'Game not found' }, 404)

  const player: Player = row.player1Id === playerId ? 'p1' : 'p2'
  return c.json(stateForPlayer(state, player))
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
  if (state.turnPlayer !== player) return c.json({ error: 'Not your turn' }, 400)

  let move: Record<string, unknown>
  try {
    move = await getAIMove(state, player)
  } catch (e: any) {
    return c.json({ error: `AI error: ${e.message}` }, 500)
  }

  const result = await handleMove(gameId, state, player, move as any)
  if ('error' in result) return c.json({ error: result.error }, 400)
  return c.json({ ok: true, move })
})

export default app
