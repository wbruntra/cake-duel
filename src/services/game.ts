import {
  playAttack,
  playBlock,
  skipBlock,
  pass,
  resolveTurn,
  resupply,
  finishBout,
  startNextBout,
  ackBoutEnd,
  ackTurnResolution,
  ackChallengeResult,
  determineBoutWinnerOnPass,
  resolveChallenge,
  toChallengeResult,
  toTurnResolution,
} from '../game/engine'
import type { GameState, Player } from '../game/types'
import { opponent } from '../game/types'
import { loadGame, saveGame, appendEvent } from '../db/game-store'
import { broadcast } from './connections'

export type Move =
  | { type: 'attack'; cardIds: string[]; claimedName: string }
  | { type: 'block'; cardIds: string[] }
  | { type: 'skipBlock' }
  | { type: 'pass' }
  | { type: 'resolve' }
  | { type: 'challenge'; target: 'attack' | 'block' }
  | { type: 'turnAck' }
  | { type: 'boutAck' }
  | { type: 'challengeAck' }

const BOUT_ACK_TIMEOUT_MS = 30000
const CHALLENGE_ACK_TIMEOUT_MS = 15000
const TURN_RESOLUTION_TIMEOUT_MS = 12000

const boutTimers = new Map<string, ReturnType<typeof setTimeout>>()
const challengeTimers = new Map<string, ReturnType<typeof setTimeout>>()
const turnResolutionTimers = new Map<string, ReturnType<typeof setTimeout>>()

function clearBoutTimer(gameId: string) {
  const t = boutTimers.get(gameId)
  if (t) {
    clearTimeout(t)
    boutTimers.delete(gameId)
  }
}

function clearChallengeTimer(gameId: string) {
  const t = challengeTimers.get(gameId)
  if (t) {
    clearTimeout(t)
    challengeTimers.delete(gameId)
  }
}

function clearTurnResolutionTimer(gameId: string) {
  const t = turnResolutionTimers.get(gameId)
  if (t) {
    clearTimeout(t)
    turnResolutionTimers.delete(gameId)
  }
}

function scheduleBoutAutoAdvance(gameId: string) {
  clearBoutTimer(gameId)
  boutTimers.set(
    gameId,
    setTimeout(async () => {
      boutTimers.delete(gameId)
      const state = await loadGame(gameId)
      if (!state || state.turnPhase !== 'bout_end') return
      const next = startNextBout(state)
      await saveGame(next)
      broadcast(next)
    }, BOUT_ACK_TIMEOUT_MS),
  )
}

function scheduleChallengeAutoAdvance(gameId: string) {
  clearChallengeTimer(gameId)
  challengeTimers.set(
    gameId,
    setTimeout(async () => {
      challengeTimers.delete(gameId)
      const state = await loadGame(gameId)
      if (!state || state.turnPhase !== 'challenge_result' || !state.challengeResult) return
      const next = finishBout(state, state.challengeResult.boutWinner)
      await saveGame(next)
      broadcast(next)
      if (next.turnPhase === 'bout_end') scheduleBoutAutoAdvance(gameId)
    }, CHALLENGE_ACK_TIMEOUT_MS),
  )
}

function scheduleTurnResolutionAutoAdvance(gameId: string) {
  clearTurnResolutionTimer(gameId)
  turnResolutionTimers.set(
    gameId,
    setTimeout(async () => {
      turnResolutionTimers.delete(gameId)
      const state = await loadGame(gameId)
      if (!state || state.turnPhase !== 'turn_resolution') return
      await advancePastTurnResolution(gameId, state)
    }, TURN_RESOLUTION_TIMEOUT_MS),
  )
}

async function advancePastTurnResolution(gameId: string, state: GameState) {
  if (state.lastTurnResult?.boutOver) {
    const attacker = state.lastTurnResult.attackClaim.player
    const boutWinner: Player = state.lastTurnResult.cakesStolen > 0 ? attacker : opponent(attacker)
    const next = finishBout(state, boutWinner)
    await saveGame(next)
    await logBoutOrGameEnd(gameId, next, 'attack')
    broadcast(next)
    if (next.turnPhase === 'bout_end') scheduleBoutAutoAdvance(gameId)
  } else {
    const next = resupply(state)
    await saveGame(next)
    broadcast(next)
  }
}

async function logBoutOrGameEnd(gameId: string, state: GameState, reason: string) {
  if (state.status === 'finished') {
    await appendEvent(gameId, null, 'game_over', { winner: state.winner })
  } else if (state.turnPhase === 'bout_end') {
    const bout = state.currentBout
    const boutWinner = state.boutWinners[bout - 1]
    await appendEvent(gameId, null, 'bout_end', { bout, boutWinner, reason })
  }
}

export async function handleMove(
  gameId: string,
  state: GameState,
  player: Player,
  move: Move,
): Promise<{ error: string } | { ok: true }> {
  switch (move.type) {
    case 'attack': {
      const result = playAttack(state, player, move.cardIds, move.claimedName)
      if (result.error) return { error: result.error }
      clearChallengeTimer(gameId)
      await saveGame(result.state)
      await appendEvent(gameId, player, 'attack', {
        cardIds: move.cardIds,
        claimedName: move.claimedName,
        count: move.cardIds.length,
      })
      broadcast(result.state)
      return { ok: true }
    }

    case 'block': {
      const result = playBlock(state, player, move.cardIds)
      if (result.error) return { error: result.error }
      await saveGame(result.state)
      await appendEvent(gameId, player, 'block', {
        cardIds: move.cardIds,
        count: move.cardIds.length,
      })
      broadcast(result.state)
      return { ok: true }
    }

    case 'skipBlock': {
      const result = skipBlock(state, player)
      if (result.error) return { error: result.error }
      await saveGame(result.state)
      await appendEvent(gameId, player, 'skip_block')
      broadcast(result.state)
      return { ok: true }
    }

    case 'pass': {
      const result = pass(state, player)
      if (result.error) return { error: result.error }
      await appendEvent(gameId, player, 'pass')
      if (result.doublePass) {
        const boutWinner = determineBoutWinnerOnPass(result.state)
        const next = finishBout(result.state, boutWinner)
        await saveGame(next)
        await logBoutOrGameEnd(gameId, next, 'pass')
        broadcast(next)
        if (next.turnPhase === 'bout_end') scheduleBoutAutoAdvance(gameId)
      } else {
        await saveGame(result.state)
        broadcast(result.state)
      }
      return { ok: true }
    }

    case 'resolve': {
      const { state: resolved, turnResult } = resolveTurn(state)
      const next = toTurnResolution(resolved, turnResult)
      await saveGame(next)
      await appendEvent(gameId, state.attackClaim!.player, 'turn_resolve', {
        attackClaim: turnResult.attackClaim,
        blockClaim: turnResult.blockClaim,
        cakesStolen: turnResult.cakesStolen,
        defenderCakes: turnResult.defenderCakes,
        boutOver: turnResult.boutOver,
      })
      broadcast(next)
      scheduleTurnResolutionAutoAdvance(gameId)
      return { ok: true }
    }

    case 'challenge': {
      if (move.target !== 'attack' && move.target !== 'block') {
        return { error: 'Invalid challenge target' }
      }
      const result = resolveChallenge(state, player, move.target)
      if ('error' in result) return { error: result.error }
      const next = toChallengeResult(result.state, result.challengeResult)
      await saveGame(next)
      await appendEvent(gameId, player, 'challenge', {
        target: move.target,
        claimWasTruthful: result.challengeResult.claimWasTruthful,
        boutWinner: result.challengeResult.boutWinner,
        revealedCardNames: result.challengeResult.revealedCardNames,
      })
      broadcast(next)
      scheduleChallengeAutoAdvance(gameId)
      return { ok: true }
    }

    case 'turnAck': {
      const ackResult = ackTurnResolution(state, player)
      if (ackResult.error) return { error: ackResult.error }
      if (ackResult.bothAcked) {
        clearTurnResolutionTimer(gameId)
        await advancePastTurnResolution(gameId, ackResult.state)
      } else {
        await saveGame(ackResult.state)
        broadcast(ackResult.state)
      }
      return { ok: true }
    }

    case 'boutAck': {
      const ackResult = ackBoutEnd(state, player)
      if (ackResult.error) return { error: ackResult.error }
      if (ackResult.bothAcked) {
        clearBoutTimer(gameId)
        const next = startNextBout(ackResult.state)
        await saveGame(next)
        broadcast(next)
      } else {
        await saveGame(ackResult.state)
        broadcast(ackResult.state)
      }
      return { ok: true }
    }

    case 'challengeAck': {
      const ackResult = ackChallengeResult(state, player)
      if (ackResult.error) return { error: ackResult.error }
      if (ackResult.bothAcked) {
        clearChallengeTimer(gameId)
        const next = finishBout(ackResult.state, state.challengeResult!.boutWinner)
        await saveGame(next)
        await logBoutOrGameEnd(gameId, next, 'challenge')
        broadcast(next)
        if (next.turnPhase === 'bout_end') scheduleBoutAutoAdvance(gameId)
      } else {
        await saveGame(ackResult.state)
        broadcast(ackResult.state)
      }
      return { ok: true }
    }

    default:
      return { error: `Unknown move type: ${(move as any).type}` }
  }
}
