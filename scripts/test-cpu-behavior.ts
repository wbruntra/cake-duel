/**
 * Replication script: simulates a human (p1) playing against CPU (p2, medium)
 * to observe what moves the CPU selects — especially how often it challenges.
 *
 * Usage: bun run scripts/test-cpu-behavior.ts [--seed=123] [--games=10] [--verbose]
 *        [--bluff-mode=always|never|alternate]
 *
 * Set CPU_VERBOSE=1 to see CPU decision logs.
 *
 * --bluff-mode controls human attack behavior:
 *   always    – human always bluffs (plays a non-matching card under a false name)
 *   never     – human always attacks truthfully (default)
 *   alternate – human alternates bluff/truthful each attack
 *
 * KEY DIAGNOSTIC: The script logs attackClaim.playedCardIds at the moment the CPU
 * must decide whether to challenge. If the CPU can see those IDs, it has perfect
 * knowledge of whether the attack is a bluff — that's the information leak.
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

const bluffModeArg = Bun.argv.find((a) => a.startsWith('--bluff-mode='))?.split('=')[1] ?? 'never'
type BluffMode = 'always' | 'never' | 'alternate'
const BLUFF_MODE: BluffMode = (bluffModeArg as BluffMode) || 'never'

type CPUMoveLog = {
  bout: number
  turn: number
  phase: string
  cpuHandSummary: string
  humanAction: string
  humanAttackWasBluff: boolean | null
  /** The actual card IDs the CPU can read from attackClaim.playedCardIds at decision time */
  attackClaimPlayedCardIds: string[] | null
  cpuAction: string
  cpuHandAfter: string | null
  result: string
}

let stats = {
  totalMoves: 0,
  challenges: 0,
  challengeWon: 0,
  challengeLost: 0,
  // Broken down by whether the human attack was a bluff
  challengesOnBluff: 0,
  challengesOnTruth: 0,
  bluffAttacks: 0,
  truthfulAttacks: 0,
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
    challengesOnBluff: 0,
    challengesOnTruth: 0,
    bluffAttacks: 0,
    truthfulAttacks: 0,
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

// Tracks alternating bluff/truthful for 'alternate' mode
let nextHumanAttackIsBluff = true

/**
 * Human player (p1) attacks according to BLUFF_MODE.
 *
 * Returns: { result, wasBluff }
 * wasBluff indicates whether the attack was a bluff (card played ≠ claimed name).
 */
function humanAttack(state: GameState): {
  result: ReturnType<typeof playAttack>
  wasBluff: boolean
} {
  const hand = getHand(state, 'p1')
  const attackers = ['wizard', 'archer', 'soldier']
  const nonAttackers = hand.filter((id) => !attackers.includes(id))

  const wantsBluff =
    BLUFF_MODE === 'always' || (BLUFF_MODE === 'alternate' && nextHumanAttackIsBluff)

  if (BLUFF_MODE === 'alternate') {
    nextHumanAttackIsBluff = !nextHumanAttackIsBluff
  }

  // Try a bluff: play a non-attacker card but claim it's an attacker
  if (wantsBluff && nonAttackers.length > 0) {
    // Pick a claimable non-attacker card and claim it as 'Soldier'
    const bluffCard = nonAttackers[0]!
    const card = getCardById(bluffCard)
    if (card && !card.isUnclaimable) {
      return {
        result: playAttack(state, 'p1', [bluffCard], 'Soldier'),
        wasBluff: true,
      }
    }
  }

  // Try a truthful attack
  for (const atk of attackers) {
    const idx = hand.indexOf(atk)
    if (idx !== -1) {
      const card = getCardById(atk)!
      return {
        result: playAttack(state, 'p1', [hand[idx]!], card.name),
        wasBluff: false,
      }
    }
  }

  // Nothing useful; pass
  return { result: pass(state, 'p1'), wasBluff: false }
}

/** Simulate playing one bout. Returns the bout winner. */
function simulateBout(initialState: GameState, log: CPUMoveLog[]): Player | null {
  let state = { ...initialState }
  let turn = 0
  const maxTurns = 40

  // Track whether the pending human attack (not yet resolved by CPU) was a bluff
  let pendingHumanAttackWasBluff: boolean | null = null

  while (turn < maxTurns) {
    turn++

    // Handle non-action phases automatically
    if (state.turnPhase === 'turn_resolution') {
      const attacker = state.lastTurnResult!.attackClaim.player
      if (state.lastTurnResult?.boutOver) {
        const boutWinner: Player =
          state.lastTurnResult.cakesStolen > 0 ? attacker : opponent(attacker)
        state = finishBout(state, boutWinner)
        pendingHumanAttackWasBluff = null
        continue
      }
      state = resupply(state)
      pendingHumanAttackWasBluff = null
      continue
    }

    if (state.turnPhase === 'challenge_result') {
      state = finishBout(state, state.challengeResult!.boutWinner)
      pendingHumanAttackWasBluff = null
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
      if (phase === 'attack') {
        const { result, wasBluff } = humanAttack(state)
        if ('error' in result) {
          log.push({
            bout: state.currentBout,
            turn,
            phase,
            cpuHandSummary: summarizeHand(getHand(state, 'p2')),
            humanAction: `ERROR: ${result.error}`,
            humanAttackWasBluff: null,
            attackClaimPlayedCardIds: null,
            cpuAction: '-',
            cpuHandAfter: null,
            result: 'human error',
          })
          return null
        }
        pendingHumanAttackWasBluff = wasBluff
        if (wasBluff) stats.bluffAttacks++
        else stats.truthfulAttacks++
        state = result.state
      } else if (phase === 'block') {
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
        const { state: resolved, turnResult } = resolveTurn(state)
        state = toTurnResolution(resolved, turnResult)
      }
    } else {
      // CPU's turn (p2)
      const cpuHandBefore = [...getHand(state, 'p2')]
      const cpuHandSummary = summarizeHand(cpuHandBefore)

      // DIAGNOSTIC: capture what the CPU can read from attackClaim.playedCardIds right now
      const visiblePlayedCardIds = state.attackClaim?.playedCardIds ?? null

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
              continue
            }
          }
          break

        case 'challenge':
          stats.challenges++
          // Only attribute bluff/truth stats when CPU challenges a human ATTACK
          // (block phase, attacker = p1). Resolve-phase block challenges are separate.
          if (
            phase === 'block' &&
            state.attackClaim?.player === 'p1' &&
            pendingHumanAttackWasBluff !== null
          ) {
            if (pendingHumanAttackWasBluff) stats.challengesOnBluff++
            else stats.challengesOnTruth++
          }
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
          }
          break

        case 'resolve':
          stats.resolves++
          const resResult = resolveTurn(state)
          state = toTurnResolution(resResult.state, resResult.turnResult)
          break

        case 'turnAck':
          state = { ...state }
          break

        default:
          resultStr = `UNKNOWN: ${(move as any).type}`
      }

      // Only log CPU block/challenge decisions (the interesting ones)
      if (phase === 'block' || phase === 'resolve') {
        log.push({
          bout: state.currentBout,
          turn,
          phase,
          cpuHandSummary,
          humanAction:
            phase === 'block'
              ? `defending vs ${state.attackClaim?.cardName ?? '?'}x${state.attackClaim?.count ?? 0} (humanBluff=${pendingHumanAttackWasBluff})`
              : `human turn in ${phase}`,
          humanAttackWasBluff: pendingHumanAttackWasBluff,
          attackClaimPlayedCardIds: visiblePlayedCardIds,
          cpuAction: moveStr,
          cpuHandAfter,
          result: resultStr,
        })
      }
    }

    if (state.turnPhase === 'challenge_result') {
      state = finishBout(state, state.challengeResult!.boutWinner)
      pendingHumanAttackWasBluff = null
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

console.log(`Seed: ${seed} | Games: ${numGames} | BluffMode: ${BLUFF_MODE}`)
console.log('='.repeat(60))
console.log('NOTE: attackClaim.playedCardIds shows actual card IDs the CPU can read.')
console.log('      If CPU challenges 100% of bluffs and 0% of truths, info is leaking.')
console.log('='.repeat(60))

let gameCounter = seed
loadKnowledge()
const kStats = getKnowledgeStats()
console.log(`Knowledge DB: ${kStats.situations} situations, ${kStats.entries} entries`)

const allLogs: CPUMoveLog[][] = []

let rng = seed
function seededRandom(): number {
  rng ^= rng << 13
  rng ^= rng >> 17
  rng ^= rng << 5
  return (rng >>> 0) / 4294967296
}
const origRandom = Math.random
Math.random = seededRandom

// Totals across all games
let grandChallenges = 0
let grandChallengeWon = 0
let grandChallengesOnBluff = 0
let grandChallengesOnTruth = 0
let grandBluffAttacks = 0
let grandTruthAttacks = 0

try {
  for (let g = 0; g < numGames; g++) {
    const log: CPUMoveLog[] = []
    resetStats()
    nextHumanAttackIsBluff = true

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

    grandChallenges += stats.challenges
    grandChallengeWon += stats.challengeWon
    grandChallengesOnBluff += stats.challengesOnBluff
    grandChallengesOnTruth += stats.challengesOnTruth
    grandBluffAttacks += stats.bluffAttacks
    grandTruthAttacks += stats.truthfulAttacks

    console.log(`\nGame ${g + 1}: Winner=${winner === 'p1' ? 'Human' : 'CPU'}`)
    console.log(`  Attacks: human bluff=${stats.bluffAttacks} truthful=${stats.truthfulAttacks}`)
    console.log(
      `  Challenges: total=${stats.challenges} (onBluff=${stats.challengesOnBluff} onTruth=${stats.challengesOnTruth}) won=${stats.challengeWon} lost=${stats.challengeLost}`,
    )

    // Show each CPU block/challenge decision with the diagnostic info
    for (const entry of log) {
      if (entry.phase !== 'block') continue
      const isChallenge = entry.cpuAction.startsWith('CHALLENGE')
      const bluffStr =
        entry.humanAttackWasBluff === true
          ? '[BLUFF]'
          : entry.humanAttackWasBluff === false
            ? '[TRUTH]'
            : '[?]'
      const leakStr = entry.attackClaimPlayedCardIds
        ? `claimIds=${entry.attackClaimPlayedCardIds.join(',')}`
        : 'claimIds=null'
      if (VERBOSE || isChallenge || BLUFF_MODE !== 'never') {
        console.log(
          `  ${bluffStr} CPU sees: ${leakStr} | human: ${entry.humanAction} → CPU: ${entry.cpuAction} | ${entry.result}`,
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
console.log(`Games: ${numGames} | BluffMode: ${BLUFF_MODE}`)
console.log(`Human attacks: bluff=${grandBluffAttacks} truthful=${grandTruthAttacks}`)
console.log(`Total CPU challenges: ${grandChallenges}`)

if (grandBluffAttacks > 0) {
  const bluffChallengeRate = ((grandChallengesOnBluff / grandBluffAttacks) * 100).toFixed(1)
  console.log(
    `  Challenges on BLUFF attacks: ${grandChallengesOnBluff}/${grandBluffAttacks} = ${bluffChallengeRate}%`,
  )
}
if (grandTruthAttacks > 0) {
  const truthChallengeRate = ((grandChallengesOnTruth / grandTruthAttacks) * 100).toFixed(1)
  console.log(
    `  Challenges on TRUTHFUL attacks: ${grandChallengesOnTruth}/${grandTruthAttacks} = ${truthChallengeRate}%`,
  )
}

console.log(
  `Challenge win rate: ${grandChallengeWon}/${grandChallenges} = ${grandChallenges > 0 ? ((grandChallengeWon / grandChallenges) * 100).toFixed(1) : 0}%`,
)

const bluffChallengeRate =
  grandBluffAttacks > 0 ? ((grandChallengesOnBluff / grandBluffAttacks) * 100).toFixed(1) : 'N/A'
const truthChallengeRate =
  grandTruthAttacks > 0 ? ((grandChallengesOnTruth / grandTruthAttacks) * 100).toFixed(1) : 'N/A'

if (grandBluffAttacks > 0 && grandTruthAttacks > 0) {
  const diff = Math.abs(
    grandChallengesOnBluff / grandBluffAttacks - grandChallengesOnTruth / grandTruthAttacks,
  )
  if (diff < 0.1) {
    console.log(
      'DIAGNOSIS: CPU challenges bluffs and truths at similar rates — no information leak detected.',
    )
  } else if (
    grandChallengesOnBluff / grandBluffAttacks >
    grandChallengesOnTruth / grandTruthAttacks + 0.3
  ) {
    console.log(
      'DIAGNOSIS: CPU challenges bluffs significantly more than truths — possible information leak!',
    )
    console.log('  Check if attackClaim.playedCardIds is being read by the MCTS.')
  } else {
    console.log(
      'DIAGNOSIS: Challenge rates differ somewhat — may reflect statistical reasoning, not leakage.',
    )
  }
}
