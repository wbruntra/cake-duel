import type { GameState, Player } from '../game/types'
import { loadGame, saveGame } from '../db/game-store'
import { broadcast } from './connections'
import { handleMove } from './game'
import { getCPUMove } from '../ai/cpu-player'
import type { Move } from './game'

const CPU_DELAY_MS = 800

const cpuTimers = new Map<string, ReturnType<typeof setTimeout>>()

function clearCPUTimer(gameId: string) {
  const t = cpuTimers.get(gameId)
  if (t) {
    clearTimeout(t)
    cpuTimers.delete(gameId)
  }
}

function isCPUActionPhase(state: GameState): boolean {
  if (!state.cpuPlayer) return false
  if (state.status !== 'playing') return false

  const phase = state.turnPhase
  if (phase === 'attack' || phase === 'block' || phase === 'resolve') {
    return state.turnPlayer === state.cpuPlayer
  }
  return false
}

function isCPUAckPhase(state: GameState): boolean {
  if (!state.cpuPlayer) return false
  if (state.status !== 'playing') return false

  const phase = state.turnPhase
  if (phase === 'turn_resolution' || phase === 'challenge_result' || phase === 'bout_end') {
    return true
  }
  return false
}

async function executeCPUMove(gameId: string) {
  clearCPUTimer(gameId)

  const state = await loadGame(gameId)
  if (!state || state.status !== 'playing' || !state.cpuPlayer) return

  const cpuPlayer: Player = state.cpuPlayer

  if (isCPUAckPhase(state)) {
    let ackMove: Move
    if (state.turnPhase === 'turn_resolution') {
      ackMove = { type: 'turnAck' }
    } else if (state.turnPhase === 'challenge_result') {
      ackMove = { type: 'challengeAck' }
    } else if (state.turnPhase === 'bout_end') {
      ackMove = { type: 'boutAck' }
    } else {
      return
    }

    const result = await handleMove(gameId, state, cpuPlayer, ackMove)
    if ('error' in result) {
      console.error('CPU ack error:', result.error)
    }

    const newState = await loadGame(gameId)
    if (newState) scheduleCPUMoves(gameId)
    return
  }

  if (!isCPUActionPhase(state)) return

  try {
    const move = getCPUMove(state, cpuPlayer, state.cpuDifficulty || 'medium')
    const result = await handleMove(gameId, state, cpuPlayer, move)
    if ('error' in result) {
      console.error('CPU move error:', result.error)
    }
  } catch (e) {
    console.error('CPU move exception:', e)
  }

  const newState = await loadGame(gameId)
  if (newState) scheduleCPUMoves(gameId)
}

export function scheduleCPUMoves(gameId: string) {
  clearCPUTimer(gameId)

  const checkAndSchedule = async () => {
    const state = await loadGame(gameId)
    if (!state || state.status !== 'playing' || !state.cpuPlayer) return

    if (isCPUActionPhase(state) || isCPUAckPhase(state)) {
      const delay = isCPUAckPhase(state) ? 300 : CPU_DELAY_MS
      cpuTimers.set(
        gameId,
        setTimeout(() => executeCPUMove(gameId), delay),
      )
    }
  }

  checkAndSchedule()
}

export function cancelCPUMoves(gameId: string) {
  clearCPUTimer(gameId)
}
