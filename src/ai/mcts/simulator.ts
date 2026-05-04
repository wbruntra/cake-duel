import type { GameState, Player, Claim } from '../../game/types'
import { opponent, getHand, getCakes } from '../../game/types'
import {
  playAttack,
  playBlock,
  skipBlock,
  pass,
  resolveTurn,
  toTurnResolution,
  resolveChallenge,
  toChallengeResult,
  finishBout,
  startNextBout,
  determineBoutWinnerOnPass,
  newBout,
  resupply,
} from '../../game/engine'
import { getCardByName, getCardById, createDeck } from '../../game/cards'
import type { Action } from './types'

// Public knowledge: how many copies of each card exist in a full deck.
// Claiming more than this is always detectable as a bluff and never worth trying.
const DECK_TOTALS: Record<string, number> = {}
for (const id of createDeck()) {
  DECK_TOTALS[id] = (DECK_TOTALS[id] ?? 0) + 1
}

function subsets(arr: string[], minSize: number, maxSize: number): string[][] {
  const results: string[][] = []
  const n = arr.length
  for (let mask = 1; mask < 1 << n; mask++) {
    const bits = popcount(mask)
    if (bits < minSize || bits > maxSize) continue
    const subset: string[] = []
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) subset.push(arr[i]!)
    }
    results.push(subset)
  }
  return results
}

function popcount(n: number): number {
  let count = 0
  while (n) {
    count += n & 1
    n >>= 1
  }
  return count
}

const ATTACKER_NAMES = ['Soldier', 'Archer', 'Wizard']

export function getLegalActions(state: GameState, player: Player): Action[] {
  const actions: Action[] = []
  const phase = state.turnPhase
  const isMyTurn = state.turnPlayer === player

  if (!isMyTurn) return actions

  if (phase === 'attack') {
    actions.push({ type: 'pass' })

    const hand = getHand(state, player)
    const claimable = hand.filter((id) => {
      const card = getCardById(id)
      return card && !card.isUnclaimable
    })

    const validSubsets = subsets(claimable, 1, claimable.length)
    for (const cardIds of validSubsets) {
      for (const claimedName of ATTACKER_NAMES) {
        const claimedId = claimedName.toLowerCase()

        const truthful = cardIds.every((id) => {
          const card = getCardById(id)
          return card && card.name.toLowerCase() === claimedName.toLowerCase()
        })

        // Bluffs are only realistic with a single card — real players bluff by
        // playing one card and naming a different type. Multi-card bluffs are
        // easy to detect and almost never correct, so exclude them entirely.
        if (!truthful && cardIds.length > 1) continue

        // Skip claims that exceed the total copies in the deck — always detectable.
        if (cardIds.length > (DECK_TOTALS[claimedId] ?? 0)) continue

        actions.push({ type: 'attack', cardIds, claimedName, truthful })
      }
    }
  } else if (phase === 'block') {
    actions.push({ type: 'skipBlock' })

    if (!state.attackClaim) return [{ type: 'skipBlock' }]

    // Challenge is handled exclusively by deterministicAction via statistical
    // inference — not included here so MCTS never picks it based on biased data.

    const attackCard = getCardByName(state.attackClaim.cardName)
    if (!attackCard) return [{ type: 'skipBlock' }]

    const hand = getHand(state, player)
    const blockerCardId = attackCard.name === 'Wizard' ? 'scientist' : 'defender'
    const blockSubsets = subsets(hand, 1, hand.length)
    for (const cardIds of blockSubsets) {
      const truthful = cardIds.every((id) => id === blockerCardId)
      actions.push({ type: 'block', cardIds, truthful })
    }
  } else if (phase === 'resolve') {
    actions.push({ type: 'resolve' })
    // Challenge of block also handled exclusively by deterministicAction.
  }

  return actions
}

export function applyAction(state: GameState, player: Player, action: Action): GameState {
  let result: any

  switch (action.type) {
    case 'attack': {
      result = playAttack(state, player, action.cardIds, action.claimedName)
      if (result.error) return state
      return result.state
    }
    case 'pass': {
      result = pass(state, player)
      if (result.error) return state
      if (result.doublePass) {
        const boutWinner = determineBoutWinnerOnPass(result.state)
        return finishBout(result.state, boutWinner)
      }
      return result.state
    }
    case 'block': {
      result = playBlock(state, player, action.cardIds)
      if (result.error) return state
      return result.state
    }
    case 'skipBlock': {
      result = skipBlock(state, player)
      if (result.error) return state
      return result.state
    }
    case 'challenge': {
      result = resolveChallenge(state, player, action.target)
      if ('error' in result) return state
      const withResult = toChallengeResult(result.state, result.challengeResult)
      return finishBout(withResult, result.challengeResult.boutWinner)
    }
    case 'resolve': {
      if (!state.attackClaim) return state
      const { state: resolved, turnResult } = resolveTurn(state)
      const withResult = toTurnResolution(resolved, turnResult)
      if (turnResult.boutOver) {
        const attacker = turnResult.attackClaim.player
        const boutWinner: Player = turnResult.cakesStolen > 0 ? attacker : opponent(attacker)
        return finishBout(withResult, boutWinner)
      }
      return resupply(withResult)
    }
    default:
      return state
  }
}

export function isBoutOver(state: GameState): boolean {
  return (
    state.status === 'finished' ||
    state.turnPhase === 'bout_end' ||
    state.turnPhase === 'game_over'
  )
}

export function isMatchOver(state: GameState): boolean {
  return state.status === 'finished' || state.turnPhase === 'game_over'
}

export function getBoutWinner(state: GameState): Player | null {
  if (!isBoutOver(state)) return null
  const boutIndex = state.currentBout - 1
  const winner = state.boutWinners[boutIndex]
  return (winner as Player) ?? null
}

export function getMatchWinner(state: GameState): Player | null {
  if (!isMatchOver(state)) return null
  return state.winner as Player | null
}

export function advanceToNextBout(state: GameState): GameState {
  if (isMatchOver(state)) return state
  return startNextBout(state)
}

export function createSimulatedBout(): GameState {
  const gameState: GameState = {
    id: 'sim',
    status: 'playing',
    player1Id: 'p1',
    player1Name: 'Player 1',
    player2Id: 'p2',
    player2Name: 'Player 2',
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
  return newBout(gameState, 'p1')
}
