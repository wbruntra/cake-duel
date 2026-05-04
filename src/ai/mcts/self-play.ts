import type { GameState, Player } from '../../game/types'
import { opponent } from '../../game/types'
import { newBout, startNextBout } from '../../game/engine'
import {
  getLegalActions,
  applyAction,
  isBoutOver,
  getBoutWinner,
  advanceToNextBout,
} from './simulator'
import { sampleDeterminization } from './determinizer'
import { mctsSearch } from './search'
import type { Action, MCTSConfig, MCTSDifficulty } from './types'
import { DIFFICULTY_CONFIGS } from './types'
import { deterministicAction } from '../cpu-player'
import {
  knowledgeGuidedPick,
  encodeSituation,
  encodeAction,
  recordResult,
  saveKnowledge,
  loadKnowledge,
  getKnowledgeStats,
} from './knowledge'

function randomAction(state: GameState, player: Player): Action {
  const actions = getLegalActions(state, player)
  if (actions.length === 0) throw new Error('No legal actions')
  return actions[Math.floor(Math.random() * actions.length)]!
}

function cpuAction(
  state: GameState,
  player: Player,
  config: MCTSConfig,
): { action: Action; timeMs: number } {
  const start = Date.now()
  const forced = deterministicAction(state, player)
  if (forced) return { action: forced, timeMs: Date.now() - start }
  const result = mctsSearch(state, player, config)
  return { action: result.action, timeMs: result.timeMs }
}

function newBoutState(): GameState {
  const startingPlayer: Player = Math.random() < 0.5 ? 'p1' : 'p2'
  const state: GameState = {
    id: 'bout',
    status: 'playing',
    player1Id: 'p1',
    player1Name: 'P1',
    player2Id: 'p2',
    player2Name: 'P2',
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
  return newBout(state, startingPlayer)
}

export interface BoutSelfPlayResult {
  boutsPlayed: number
  p1Wins: number
  p2Wins: number
  draws: number
  avgMovesPerBout: number
  avgTimePerMoveMs: number
  knowledgeSituations: number
  knowledgeEntries: number
}

export function runBoutSelfPlay(
  config1: MCTSConfig | null,
  config2: MCTSConfig | null,
  numBouts: number,
): BoutSelfPlayResult {
  loadKnowledge()

  let p1Wins = 0
  let p2Wins = 0
  let draws = 0
  let totalMoves = 0
  let totalTimeMs = 0

  for (let i = 0; i < numBouts; i++) {
    let state = newBoutState()
    let moves = 0
    let boutTimeMs = 0

    const p1Records: Array<{ situationKey: string; actionKey: string }> = []
    const p2Records: Array<{ situationKey: string; actionKey: string }> = []

    while (!isBoutOver(state)) {
      const activePlayer = state.turnPlayer
      if (!activePlayer) break

      if (
        state.turnPhase === 'attack' ||
        state.turnPhase === 'block' ||
        state.turnPhase === 'resolve'
      ) {
        const config = activePlayer === 'p1' ? config1 : config2
        let action: Action

        if (config) {
          const result = cpuAction(state, activePlayer, config)
          action = result.action
          boutTimeMs += result.timeMs
        } else {
          action = randomAction(state, activePlayer)
        }

        if (activePlayer === 'p1') {
          p1Records.push({
            situationKey: encodeSituation(state, activePlayer),
            actionKey: encodeAction(action),
          })
        } else {
          p2Records.push({
            situationKey: encodeSituation(state, activePlayer),
            actionKey: encodeAction(action),
          })
        }

        state = applyAction(state, activePlayer, action)
        moves++
      } else {
        break
      }

      if (moves > 200) break
    }

    const winner = getBoutWinner(state)
    if (winner === 'p1') p1Wins++
    else if (winner === 'p2') p2Wins++
    else draws++

    for (const rec of p1Records) {
      recordResult(rec.situationKey, rec.actionKey, winner === 'p1')
    }
    for (const rec of p2Records) {
      recordResult(rec.situationKey, rec.actionKey, winner === 'p2')
    }

    totalMoves += moves
    totalTimeMs += boutTimeMs

    if ((i + 1) % 100 === 0) {
      console.log(`  ${i + 1} bouts: p1=${p1Wins} p2=${p2Wins} draws=${draws}`)
    }
  }

  saveKnowledge()
  const stats = getKnowledgeStats()

  return {
    boutsPlayed: numBouts,
    p1Wins,
    p2Wins,
    draws,
    avgMovesPerBout: totalMoves / numBouts,
    avgTimePerMoveMs: totalTimeMs / Math.max(totalMoves, 1),
    knowledgeSituations: stats.situations,
    knowledgeEntries: stats.entries,
  }
}

if (import.meta.main) {
  const difficulty1: MCTSDifficulty = (process.argv[2] as MCTSDifficulty) || 'medium'
  const difficulty2: MCTSDifficulty = (process.argv[3] as MCTSDifficulty) || 'medium'
  const numBouts = parseInt(process.argv[4] || '100', 10)

  console.log(`Bout self-play: ${difficulty1} vs ${difficulty2}, ${numBouts} bouts`)
  const config1 = DIFFICULTY_CONFIGS[difficulty1]
  const config2 = DIFFICULTY_CONFIGS[difficulty2]

  const result = runBoutSelfPlay(config1, config2, numBouts)
  console.log(`\nResults:`)
  console.log(
    `  P1 (${difficulty1}) wins: ${result.p1Wins} (${((result.p1Wins / result.boutsPlayed) * 100).toFixed(1)}%)`,
  )
  console.log(
    `  P2 (${difficulty2}) wins: ${result.p2Wins} (${((result.p2Wins / result.boutsPlayed) * 100).toFixed(1)}%)`,
  )
  console.log(`  Draws: ${result.draws}`)
  console.log(`  Avg moves/bout: ${result.avgMovesPerBout.toFixed(1)}`)
  console.log(`  Avg time/move: ${result.avgTimePerMoveMs.toFixed(1)}ms`)
  console.log(
    `  Knowledge: ${result.knowledgeSituations} situations, ${result.knowledgeEntries} entries`,
  )
}
