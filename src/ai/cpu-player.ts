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

export function deterministicAction(state: GameState, player: Player): Action | null {
  const phase = state.turnPhase

  // Attack phase: if opponent just passed and I have >= their cakes, passing is an instant win.
  if (phase === 'attack' && state.passedLast === opponent(player)) {
    if (getCakes(state, player) >= getCakes(state, opponent(player))) {
      vlog(`DETERMINISTIC pass: opponent passed, I have >= cakes → instant win`)
      return { type: 'pass' }
    }
  }

  // Block phase: if I've personally accounted for all copies of the claimed attack card,
  // the claim is impossible and challenging is a guaranteed win.
  if (phase === 'block' && state.attackClaim) {
    const claimedId = state.attackClaim.cardName.toLowerCase()
    const total = DECK_TOTALS[claimedId] ?? 0
    const seen = seenCount(state, player, claimedId)
    vlog(`block check: claimed=${claimedId} total=${total} seen=${seen} (hand+discard)`)
    if (claimIsImpossible(state, player, claimedId)) {
      vlog(`DETERMINISTIC challenge: ALL ${total} ${claimedId}s accounted for → impossible claim`)
      return { type: 'challenge', target: 'attack' }
    } else {
      vlog(`  claim not impossible (seen ${seen}/${total})`)
    }
  }

  // Resolve phase
  if (phase === 'resolve') {
    if (!state.blockClaim) return { type: 'resolve' }

    if (state.attackClaim && state.attackClaim.player === player) {
      const blockCardId = state.attackClaim.cardName === 'Wizard' ? 'scientist' : 'defender'
      const total = DECK_TOTALS[blockCardId] ?? 0
      const seen = seenCount(state, player, blockCardId)
      vlog(`resolve check: claimed block=${blockCardId} total=${total} seen=${seen}`)
      if (claimIsImpossible(state, player, blockCardId)) {
        vlog(
          `DETERMINISTIC challenge block: ALL ${total} ${blockCardId}s accounted for → impossible claim`,
        )
        return { type: 'challenge', target: 'block' }
      }
    }
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
