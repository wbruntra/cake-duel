import { db } from './index'
import { games, gameEvents } from './schema'
import { eq, sql } from 'drizzle-orm'
import type { GameState, Player } from '../game/types'

function parseGame(row: any): GameState {
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
    p1Discard: JSON.parse(row.p1Discard || '[]'),
    p2Discard: JSON.parse(row.p2Discard || '[]'),
    attackClaim: row.attackClaim ? JSON.parse(row.attackClaim) : null,
    blockClaim: row.blockClaim ? JSON.parse(row.blockClaim) : null,
    passedLast: row.passedLast as Player | null,
    boutEndAcks: JSON.parse(row.boutEndAcks || '[]'),
    challengeResult: row.challengeResult ? JSON.parse(row.challengeResult) : null,
    challengeAcks: JSON.parse(row.challengeAcks || '[]'),
    lastTurnResult: row.lastTurnResult ? JSON.parse(row.lastTurnResult) : null,
    turnAcks: JSON.parse(row.turnAcks || '[]'),
    lastAction: row.lastAction ? JSON.parse(row.lastAction) : null,
    cpuPlayer: row.cpuPlayer as GameState['cpuPlayer'],
    cpuDifficulty: row.cpuDifficulty as GameState['cpuDifficulty'],
  }
}

function serializeGame(state: GameState) {
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
    p1Discard: JSON.stringify(state.p1Discard),
    p2Discard: JSON.stringify(state.p2Discard),
    attackClaim: state.attackClaim ? JSON.stringify(state.attackClaim) : null,
    blockClaim: state.blockClaim ? JSON.stringify(state.blockClaim) : null,
    passedLast: state.passedLast || null,
    boutEndAcks: JSON.stringify(state.boutEndAcks),
    challengeResult: state.challengeResult ? JSON.stringify(state.challengeResult) : null,
    challengeAcks: JSON.stringify(state.challengeAcks),
    lastTurnResult: state.lastTurnResult ? JSON.stringify(state.lastTurnResult) : null,
    turnAcks: JSON.stringify(state.turnAcks),
    lastAction: state.lastAction ? JSON.stringify(state.lastAction) : null,
    cpuPlayer: state.cpuPlayer || null,
    cpuDifficulty: state.cpuDifficulty || null,
  }
}

export async function loadGame(id: string): Promise<GameState | null> {
  const rows = await db.select().from(games).where(eq(games.id, id))
  if (rows.length === 0) return null
  return parseGame(rows[0]!)
}

export async function saveGame(state: GameState) {
  await db.update(games).set(serializeGame(state)).where(eq(games.id, state.id))
}

export async function appendEvent(
  gameId: string,
  player: Player | null,
  type: string,
  data?: Record<string, unknown>,
) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(gameEvents)
    .where(eq(gameEvents.gameId, gameId))
  const count = result[0]?.count ?? 0
  await db.insert(gameEvents).values({
    gameId,
    seq: count + 1,
    type,
    player: player ?? null,
    data: data ? JSON.stringify(data) : null,
    createdAt: new Date().toISOString(),
  })
}
