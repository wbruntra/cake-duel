/**
 * Replication script: simulates a human (p1) playing truthfully against CPU (p2, medium)
 * to observe what moves the CPU selects — especially how often it challenges.
 *
 * Usage: bun run scripts/test-cpu-behavior.ts [--seed 123] [--games 10] [--verbose]
 *
 * Set CPU_VERBOSE=1 to see CPU decision logs.
 */

import {
  newBout,
  playAttack,
  playBlock,
  skipBlock,
  pass,
  resolveTurn,
  resupply,
  finishBout,
  startNextBout,
  resolveChallenge,
  toChallengeResult,
  toTurnResolution,
} from '../src/game/engine'
import { getCardById } from '../src/game/cards'
import type { GameState, Player } from '../src/game/types'
import { opponent, getHand } from '../src/game/types'
import { getCPUMove, getAvailableActions } from '../src/ai/cpu-player'
import { loadKnowledge, getKnowledgeStats } from '../src/ai/mcts/knowledge'

const VERBOSE = Bun.argv.includes('--verbose')
if (VERBOSE) Bun.env.CPU_VERBOSE = '1'

type CPUMoveLog = {
  bout: number
  turn: number
  phase: string
  cpuHandSummary: string
  humanAction: string
  cpuAction: string
  cpuHandAfter: string | null
  result: string
}

let stats = {
  totalMoves: 0,
  challenges: 0,
  challengeWon: 0,
  challengeLost: 0,
  blocks: 0,
  skipBlocks: 0,
  passes: 0,
  attacks: 0,
  resolves: 0,
  boutsPlayed: 0,
  cpuWins: 0,
  humanWins: 0,
}

function resetStats() {
  stats = {
    totalMoves: 0,
    challenges: 0,
    challengeWon: 0,
    challengeLost: 0,
    blocks: 0,
    skipBlocks: 0,
    passes: 0,
    attacks: 0,
    resolves: 0,
    boutsPlayed: 0,
    cpuWins: 0,
    humanWins: 0,
  }
}

function summarizeHand(hand: string[]): string {
  const counts: Record<string, number> = {}
  for (const id of hand) countById(id, counts)
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([id, n]) => `${id}x${n}`)
    .join(',')
}

function countById(id: string, map: Record<string, number>) {
  map[id] = (map[id] ?? 0) + 1
}

function actionSummary(move: any): string {
  switch (move.type) {
    case 'attack':
      return `attack:${move.claimedName}x${move.cardIds.length}(${move.truthful !== false ? 'T' : 'B'})`
    case 'block':
      return `block:${move.cardIds.length}c(${move.truthful !== false ? 'T' : 'B'})`
    case 'skipBlock':
      return 'skipBlock'
    case 'pass':
      return 'pass'
    case 'challenge':
      return `CHALLENGE:${move.target}`
    case 'resolve':
      return 'resolve'
    case 'turnAck':
      return 'turnAck'
    case 'boutAck':
      return 'boutAck'
    case 'challengeAck':
      return 'challengeAck'
    default:
      return `${move.type}`
  }
}

/** Human player (p1) makes a normal, truthful attack using a random attacker card from hand */
function humanAttack(state: GameState): ReturnType<typeof playAttack> {
  const hand = getHand(state, 'p1')

  // Find the best attacker card in hand
  const attackers = ['wizard', 'archer', 'soldier']
  for (const atk of attackers) {
    const idx = hand.indexOf(atk)
    if (idx !== -1) {
      const card = getCardById(atk)!
      return playAttack(state, 'p1', [hand[idx]!], card.name)
    }
  }

  // If we have no real attackers, just play the first claimable card as a bluff (truthful with wrong name)
  // or pass
  return pass(state, 'p1')
}

/** Simulate playing one bout. Returns the bout winner. */
function simulateBout(initialState: GameState, log: CPUMoveLog[]): Player | null {
  let state = { ...initialState }
  let turn = 0
  const maxTurns = 40

  while (turn < maxTurns) {
    turn++

    // Handle non-action phases automatically
    if (state.turnPhase === 'turn_resolution') {
      // Auto-ack for both
      const attacker = state.lastTurnResult!.attackClaim.player
      if (state.lastTurnResult?.boutOver) {
        const boutWinner: Player =
          state.lastTurnResult.cakesStolen > 0 ? attacker : opponent(attacker)
        state = finishBout(state, boutWinner)
        continue
      }
      state = resupply(state)
      continue
    }

    if (state.turnPhase === 'challenge_result') {
      // Auto-ack for both
      state = finishBout(state, state.challengeResult!.boutWinner)
      continue
    }

    if (state.turnPhase === 'bout_end') {
      const boutWinner = state.boutWinners[state.currentBout - 1] as Player
      stats.boutsPlayed++
      if (boutWinner === 'p2') stats.cpuWins++
      else stats.humanWins++
      state = startNextBout(state)
      if (state.turnPhase === 'game_over') return state.winner as Player | null
      continue
    }

    if (state.turnPhase === 'game_over') {
      return state.winner as Player | null
    }

    // Action phases
    const phase = state.turnPhase!
    const currentPlayer = state.turnPlayer!

    if (currentPlayer === 'p1') {
      // Human's turn: always attack truthfully
      if (phase === 'attack') {
        const result = humanAttack(state)
        if ('error' in result) {
          log.push({
            bout: state.currentBout,
            turn,
            phase,
            cpuHandSummary: summarizeHand(getHand(state, 'p2')),
            humanAction: `ERROR: ${result.error}`,
            cpuAction: '-',
            cpuHandAfter: null,
            result: 'human error',
          })
          return null
        }
        state = result.state
      } else if (phase === 'block') {
        // Human blocks with real blocker if available, otherwise skip
        const hand = getHand(state, 'p1')
        const attackCard = state.attackClaim!
        const blockerId = attackCard.cardName === 'Wizard' ? 'scientist' : 'defender'
        const blockerIdx = hand.indexOf(blockerId)
        if (blockerIdx !== -1) {
          state = playBlock(state, 'p1', [hand[blockerIdx]!]).state
        } else {
          state = skipBlock(state, 'p1').state
        }
      } else if (phase === 'resolve') {
        // Human is attacker here — just resolve (no challenge)
        const { state: resolved, turnResult } = resolveTurn(state)
        state = toTurnResolution(resolved, turnResult)
      }
    } else {
      // CPU's turn (p2)
      const cpuHandBefore = [...getHand(state, 'p2')]
      const cpuHandSummary = summarizeHand(cpuHandBefore)

      const move = getCPUMove(state, 'p2', 'medium')
      stats.totalMoves++
      const moveStr = actionSummary(move)

      let resultStr = 'ok'
      let cpuHandAfter: string | null = null

      switch (move.type) {
        case 'attack':
          stats.attacks++
          const atkResult = playAttack(state, 'p2', move.cardIds, move.claimedName)
          if ('error' in atkResult) resultStr = `ERROR: ${atkResult.error}`
          else state = atkResult.state
          cpuHandAfter = summarizeHand(getHand(state, 'p2'))
          break

        case 'block':
          stats.blocks++
          const blkResult = playBlock(state, 'p2', move.cardIds)
          if ('error' in blkResult) resultStr = `ERROR: ${blkResult.error}`
          else state = blkResult.state
          cpuHandAfter = summarizeHand(getHand(state, 'p2'))
          break

        case 'skipBlock':
          stats.skipBlocks++
          const skipResult = skipBlock(state, 'p2')
          if ('error' in skipResult) resultStr = `ERROR: ${skipResult.error}`
          else state = skipResult.state
          cpuHandAfter = summarizeHand(getHand(state, 'p2'))
          break

        case 'pass':
          stats.passes++
          const passResult = pass(state, 'p2')
          if ('error' in passResult) resultStr = `ERROR: ${passResult.error}`
          else {
            state = passResult.state
            if (passResult.doublePass) {
              resultStr = 'double-pass, bout ends'
              // resolve the bout
              const current = state
              state = { ...current }
              continue // the above needs to finish bout — handle in loop
            }
          }
          break

        case 'challenge':
          stats.challenges++
          const chalResult = resolveChallenge(state, 'p2', move.target)
          if ('error' in chalResult) {
            resultStr = `ERROR: ${chalResult.error}`
          } else {
            const cr = chalResult.challengeResult
            const won = cr.boutWinner === 'p2'
            resultStr = `${won ? 'CPU WON' : 'CPU LOST'} (truthful=${cr.claimWasTruthful})`
            if (won) stats.challengeWon++
            else stats.challengeLost++
            state = toChallengeResult(chalResult.state, cr)
            // bout will finish in the auto-ack phase
          }
          break

        case 'resolve':
          stats.resolves++
          const resResult = resolveTurn(state)
          state = toTurnResolution(resResult.state, resResult.turnResult)
          break

        case 'turnAck':
          state = { ...state } // ack handled automatically above
          break

        default:
          resultStr = `UNKNOWN: ${(move as any).type}`
      }

      log.push({
        bout: state.currentBout,
        turn,
        phase,
        cpuHandSummary,
        humanAction:
          phase === 'block'
            ? `defending vs ${state.attackClaim?.cardName}x${state.attackClaim?.count}`
            : `human turn in ${phase}`,
        cpuAction: moveStr,
        cpuHandAfter,
        result: resultStr,
      })
    }

    // Check if bout is over after challenge
    if (state.turnPhase === 'challenge_result') {
      state = finishBout(state, state.challengeResult!.boutWinner)
    }

    if (state.status === 'finished' || state.turnPhase === 'game_over') {
      if (state.winner) {
        if (state.winner === 'p2') stats.cpuWins++
        else stats.humanWins++
      }
      return state.winner as Player | null
    }
  }

  return null
}

// ─── Main ──────────────────────────────────────────────────

const args = Bun.argv.slice(2)
const numGames = parseInt(args.find((a) => a.startsWith('--games='))?.split('=')[1] ?? '10')
const seedArg = args.find((a) => a.startsWith('--seed='))
const seed = seedArg ? parseInt(seedArg.split('=')[1]!) : Date.now()

console.log(`Seed: ${seed} | Games: ${numGames}`)
console.log('='.repeat(60))

// We use a counter to seed each bout so deterministic per-game
let gameCounter = seed

// Load knowledge so we can report stats
loadKnowledge()
const kStats = getKnowledgeStats()
console.log(`Knowledge DB: ${kStats.situations} situations, ${kStats.entries} entries`)

const allLogs: CPUMoveLog[][] = []

// We need Bun SRand-like functionality. We'll just use Math.random with our seed.
// For a simple seed, we'll pre-warm with a simple LCG.
let rng = seed
function seededRandom(): number {
  // Simple xorshift
  rng ^= rng << 13
  rng ^= rng >> 17
  rng ^= rng << 5
  return (rng >>> 0) / 4294967296
}
// Override Math.random for reproducibility within our simulation
const origRandom = Math.random
Math.random = seededRandom

try {
  for (let g = 0; g < numGames; g++) {
    const log: CPUMoveLog[] = []
    resetStats()

    const gameState: GameState = {
      id: `test-${g}`,
      status: 'waiting',
      player1Id: 'p1',
      player1Name: 'Human',
      player2Id: 'p2',
      player2Name: 'CPU (Medium)',
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
      cpuPlayer: 'p2',
      cpuDifficulty: 'medium',
    }

    const initialState = newBout(gameState, 'p1')
    const winner = simulateBout(initialState, log)

    allLogs.push(log)

    console.log(`\nGame ${g + 1}: Winner=${winner === 'p1' ? 'Human' : 'CPU'}`)
    console.log(
      `  Moves: ${stats.totalMoves} | Challenges: ${stats.challenges} (won=${stats.challengeWon} lost=${stats.challengeLost}) | ` +
        `Blocks: ${stats.blocks} | SkipBlocks: ${stats.skipBlocks} | Passes: ${stats.passes} | Attacks: ${stats.attacks}`,
    )

    // Show challenge details
    for (const entry of log) {
      if (entry.cpuAction.startsWith('CHALLENGE')) {
        console.log(
          `  ⚡ ${entry.cpuAction} | CPU hand: ${entry.cpuHandSummary} | ${entry.result}`,
        )
      }
    }
  }
} finally {
  Math.random = origRandom
}

// ─── Summary ───────────────────────────────────────────────

console.log('\n' + '='.repeat(60))
console.log('SUMMARY')

let totalChallenges = 0
let totalChallengeWon = 0
let totalMoves = 0
let totalCPUWins = 0

for (const log of allLogs) {
  for (const entry of log) {
    if (entry.cpuAction.startsWith('CHALLENGE')) {
      totalChallenges++
      if (entry.result.includes('CPU WON')) totalChallengeWon++
    }
    if (
      entry.cpuAction !== '-' &&
      entry.cpuAction !== 'turnAck' &&
      entry.cpuAction !== 'boutAck' &&
      entry.cpuAction !== 'challengeAck'
    ) {
      totalMoves++
    }
  }
}

console.log(`Games played: ${numGames}`)
console.log(`Total CPU action moves: ${totalMoves}`)
console.log(
  `Total challenges: ${totalChallenges} (${totalMoves > 0 ? ((totalChallenges / totalMoves) * 100).toFixed(1) : 0}% of moves)`,
)
console.log(
  `Challenges won: ${totalChallengeWon} (${totalChallenges > 0 ? ((totalChallengeWon / totalChallenges) * 100).toFixed(1) : 0}%)`,
)
console.log(`Challenges lost: ${totalChallenges - totalChallengeWon}`)
