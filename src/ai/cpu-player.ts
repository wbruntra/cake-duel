import type { GameState, Player } from '../game/types'
import { opponent, getHand, getCakes } from '../game/types'
import type { Move } from '../services/game'
import type { Action, MCTSDifficulty } from './mcts/types'
import { DIFFICULTY_CONFIGS } from './mcts/types'
import { mctsSearch } from './mcts/search'
import { getLegalActions, isMatchOver } from './mcts/simulator'
import { createDeck } from '../game/cards'
import { knowledgeExplain } from './mcts/knowledge'

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

/**
 * Probability that a claim of `count` cards of type `cardId` is truthful,
 * based only on what this player has personally seen (own hand + own discard).
 *
 * Uses a hypergeometric model: given N_available cards of the claimed type
 * scattered among N_unknown unseen cards, what's the chance all `count`
 * played cards are the claimed type?
 */
function pTruthfulForClaim(
  state: GameState,
  player: Player,
  cardId: string,
  count: number,
): number {
  const opp = opponent(player)
  const available = (DECK_TOTALS[cardId] ?? 0) - seenCount(state, player, cardId)
  if (available < count) return 0

  const oppDiscardSize = (opp === 'p1' ? state.p1Discard : state.p2Discard).length
  const nUnknown = getHand(state, opp).length + oppDiscardSize + state.deck.length
  if (nUnknown <= 0) return 0

  // P(all `count` cards drawn from the unknown pool are the claimed type)
  let p = 1
  for (let i = 0; i < count; i++) {
    p *= (available - i) / (nUnknown - i)
  }
  return Math.max(0, p)
}

// When P(truthful) = 0 → always challenge; when P(truthful) = THRESHOLD → never challenge.
const STATISTICAL_CHALLENGE_THRESHOLD = 0.35

function statisticalChallengeProb(pTruthful: number): number {
  return Math.max(0, 1 - pTruthful / STATISTICAL_CHALLENGE_THRESHOLD)
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

    const pTruth = pTruthfulForClaim(state, player, claimedId, count)
    const challengeProb = statisticalChallengeProb(pTruth)
    vlog(
      `  statistical: P(truthful)=${pTruth.toFixed(3)} → challenge with P=${challengeProb.toFixed(3)}`,
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

      const pTruth = pTruthfulForClaim(state, player, blockCardId, count)
      const challengeProb = statisticalChallengeProb(pTruth)
      vlog(
        `  statistical block: P(truthful)=${pTruth.toFixed(3)} → challenge with P=${challengeProb.toFixed(3)}`,
      )
      if (challengeProb > 0 && Math.random() < challengeProb) {
        vlog(`  STATISTICAL challenge block: rolling ${challengeProb.toFixed(3)} → challenge`)
        return { type: 'challenge', target: 'block' }
      }
    }

    return { type: 'resolve' }
  }

  vlog(`no deterministic action → MCTS`)
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

  if (VERBOSE) {
    const actions = getLegalActions(state, player)
    const lines = knowledgeExplain(state, player, actions as Action[])
    for (const line of lines) vlog(line)
  }

  const config = DIFFICULTY_CONFIGS[difficulty]
  const result = mctsSearch(state, player, config)
  const move = actionToMove(result.action)

  vlog(
    `→ MCTS chose: ${move.type}${(move as any).target ? ':' + (move as any).target : (move as any).claimedName ? ':' + (move as any).claimedName + 'x' + (move as any).cardIds?.length : ''} (winRate=${result.winRate.toFixed(3)} iters=${result.totalIterations} time=${result.timeMs}ms)`,
  )

  return move
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
