import type { GameState, Player } from '../game/types'
import { opponent, getHand, getCakes } from '../game/types'
import type { Move } from '../services/game'
import type { Action, MCTSDifficulty } from './mcts/types'
import { getLegalActions, isMatchOver } from './mcts/simulator'
import { createDeck } from '../game/cards'
import { pickScoredAction, scoreAction } from './scoring'
import { encodeAction } from './mcts/knowledge'

const VERBOSE = !!Bun.env.CPU_VERBOSE

function vlog(...args: any[]) {
  if (VERBOSE) console.log('  [CPU]', ...args)
}

// Total copies of each card ID in a full deck — used for impossible-claim detection
const DECK_TOTALS: Record<string, number> = {}
for (const id of createDeck()) {
  DECK_TOTALS[id] = (DECK_TOTALS[id] ?? 0) + 1
}

function seenCount(state: GameState, player: Player, cardId: string): number {
  const myDiscard = player === 'p1' ? state.p1Discard : state.p2Discard
  return (
    getHand(state, player).filter((id) => id === cardId).length +
    myDiscard.filter((id) => id === cardId).length
  )
}

function claimIsImpossible(state: GameState, player: Player, cardId: string): boolean {
  const total = DECK_TOTALS[cardId] ?? 0
  const seen = seenCount(state, player, cardId)
  return total > 0 && seen >= total
}

// C(n, k) — small values only (max deck size 20), so no overflow risk.
function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1
  k = Math.min(k, n - k)
  let r = 1
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1)
  return r
}

function hypergeomPMF(N: number, K: number, n: number, k: number): number {
  if (k < 0 || k > K || k > n || n - k > N - K) return 0
  return (combinations(K, k) * combinations(N - K, n - k)) / combinations(N, n)
}

// P(claimer's hand contains ≥ `count` cards of `cardId`), from `observer`'s perspective.
// Uses a hypergeometric model on the unknown pool (claimer's hand + their discard + deck).
// This is a far better fit than P(random card = claimed type): it asks "can they have it?"
// rather than "is any specific unknown card it?", giving naturally calibrated probabilities
// (e.g. ~60% for a plausible Wizard claim vs ~19% with the old model).
function pClaimerCanHave(
  state: GameState,
  observer: Player,
  cardId: string,
  count: number,
): number {
  const claimer = opponent(observer)
  const available = (DECK_TOTALS[cardId] ?? 0) - seenCount(state, observer, cardId)
  if (available < count) return 0

  const claimerDiscard = (claimer === 'p1' ? state.p1Discard : state.p2Discard).length
  const poolSize = getHand(state, claimer).length + claimerDiscard + state.deck.length
  const handSize = getHand(state, claimer).length
  if (poolSize <= 0 || handSize <= 0) return 0

  // P(X ≥ count) where X ~ Hypergeometric(N=poolSize, K=available, n=handSize)
  let pLess = 0
  for (let k = 0; k < count; k++) pLess += hypergeomPMF(poolSize, available, handSize, k)
  return Math.max(0, 1 - pLess)
}

// Challenge if P(claimer can have it) < threshold.
// 0.40 is the game-theory break-even: challenge whenever P(claim is real) < 50%
// but with a small margin of conservatism.
const STATISTICAL_CHALLENGE_THRESHOLD = 0.4

function statisticalChallengeProb(pCanHave: number): number {
  return Math.max(0, 1 - pCanHave / STATISTICAL_CHALLENGE_THRESHOLD)
}

export function deterministicAction(state: GameState, player: Player): Action | null {
  const phase = state.turnPhase

  // Attack phase: if opponent just passed and I have >= their cakes, passing is an instant win.
  if (phase === 'attack' && state.passedLast === opponent(player)) {
    if (getCakes(state, player) >= getCakes(state, opponent(player))) {
      vlog(`DETERMINISTIC pass: opponent passed, I have >= cakes → instant win`)
      return { type: 'pass' }
    }
  }

  // Block phase: challenge if the claim is impossible or statistically unlikely.
  // All challenge decisions live here — MCTS never sees challenge as an option.
  if (phase === 'block' && state.attackClaim) {
    const claimedId = state.attackClaim.cardName.toLowerCase()
    const count = state.attackClaim.count
    const total = DECK_TOTALS[claimedId] ?? 0
    const seen = seenCount(state, player, claimedId)
    vlog(`block check: claimed=${claimedId}x${count} total=${total} seen=${seen} (hand+discard)`)

    if (claimIsImpossible(state, player, claimedId)) {
      vlog(`DETERMINISTIC challenge: ALL ${total} ${claimedId}s accounted for → impossible claim`)
      return { type: 'challenge', target: 'attack' }
    }

    const pCanHave = pClaimerCanHave(state, player, claimedId, count)
    const challengeProb = statisticalChallengeProb(pCanHave)
    vlog(
      `  statistical: P(can have)=${pCanHave.toFixed(3)} → challenge with P=${challengeProb.toFixed(3)}`,
    )
    if (challengeProb > 0 && Math.random() < challengeProb) {
      vlog(`  STATISTICAL challenge: rolling ${challengeProb.toFixed(3)} → challenge`)
      return { type: 'challenge', target: 'attack' }
    }
  }

  // Resolve phase: challenge the block if impossible or statistically unlikely.
  if (phase === 'resolve') {
    if (!state.blockClaim) return { type: 'resolve' }

    if (state.attackClaim && state.attackClaim.player === player) {
      const blockCardId = state.attackClaim.cardName === 'Wizard' ? 'scientist' : 'defender'
      const count = state.blockClaim.count
      const total = DECK_TOTALS[blockCardId] ?? 0
      const seen = seenCount(state, player, blockCardId)
      vlog(`resolve check: claimed block=${blockCardId}x${count} total=${total} seen=${seen}`)

      if (claimIsImpossible(state, player, blockCardId)) {
        vlog(
          `DETERMINISTIC challenge block: ALL ${total} ${blockCardId}s accounted for → impossible claim`,
        )
        return { type: 'challenge', target: 'block' }
      }

      const pCanHave = pClaimerCanHave(state, player, blockCardId, count)
      const challengeProb = statisticalChallengeProb(pCanHave)
      vlog(
        `  statistical block: P(can have)=${pCanHave.toFixed(3)} → challenge with P=${challengeProb.toFixed(3)}`,
      )
      if (challengeProb > 0 && Math.random() < challengeProb) {
        vlog(`  STATISTICAL challenge block: rolling ${challengeProb.toFixed(3)} → challenge`)
        return { type: 'challenge', target: 'block' }
      }
    }

    return { type: 'resolve' }
  }

  vlog(`no deterministic action → scoring`)
  return null
}

export function getCPUMove(
  state: GameState,
  player: Player,
  difficulty: MCTSDifficulty = 'medium',
): Move {
  if (isMatchOver(state)) {
    throw new Error('Game is over, no moves available')
  }

  if (state.turnPhase === 'turn_resolution') return { type: 'turnAck' }
  if (state.turnPhase === 'challenge_result') return { type: 'challengeAck' }
  if (state.turnPhase === 'bout_end') return { type: 'boutAck' }

  vlog(`--- ${player} turn, phase=${state.turnPhase} ---`)

  const forced = deterministicAction(state, player)
  if (forced) {
    vlog(
      `→ FORCED action: ${forced.type}${forced.type === 'challenge' ? ':' + (forced as any).target : ''}`,
    )
    return actionToMove(forced)
  }

  const actions = getLegalActions(state, player)
  const { action, scores } = pickScoredAction(state, player, actions, difficulty)

  if (VERBOSE) {
    const sorted = [...scores].sort((a, b) => b.score - a.score)
    for (const s of sorted.slice(0, 6)) {
      vlog(`  score: ${encodeAction(s.action as Action).padEnd(28)} ${s.score.toFixed(2)}`)
    }
    vlog(`→ scored choice: ${encodeAction(action as Action)}`)
  }

  return actionToMove(action)
}

function actionToMove(action: Action): Move {
  switch (action.type) {
    case 'attack':
    case 'pass':
    case 'block':
    case 'skipBlock':
    case 'resolve':
      return action
    case 'challenge':
      return { type: 'challenge', target: action.target }
    default:
      throw new Error(`Unknown action type: ${(action as any).type}`)
  }
}

export function getAvailableActions(state: GameState, player: Player): Action[] {
  return getLegalActions(state, player)
}
