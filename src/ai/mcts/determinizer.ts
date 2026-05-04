import type { GameState, Player } from '../../game/types'
import { opponent } from '../../game/types'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export function sampleDeterminization(state: GameState, player: Player): GameState {
  const opp = opponent(player)
  const oppHandKey = opp === 'p1' ? 'p1Hand' : 'p2Hand'
  const oppDiscardKey = opp === 'p1' ? 'p1Discard' : 'p2Discard'

  const oppHand = state[oppHandKey]
  const oppDiscard = state[oppDiscardKey]

  // The CPU only knows its own hand and its own discard pile. Everything else
  // is hidden: opponent's current hand, opponent's played (face-down) cards,
  // and the deck. Shuffle them all together and redistribute.
  const pool: string[] = [...oppHand, ...oppDiscard, ...state.deck]

  if (pool.length === 0) return { ...state }

  const shuffled = shuffle(pool)

  let offset = 0
  const newOppHand = shuffled.slice(offset, (offset += oppHand.length))
  const newOppDiscard = shuffled.slice(offset, (offset += oppDiscard.length))
  const newDeck = shuffled.slice(offset)

  // Re-sample playedCardIds for any claim made by the opponent.
  // The CPU cannot know which specific cards were played face-down, so each
  // MCTS iteration draws a fresh random sample from the opponent's new discard.
  let newAttackClaim = state.attackClaim
  if (state.attackClaim?.player === opp) {
    const count = state.attackClaim.playedCardIds.length
    newAttackClaim = { ...state.attackClaim, playedCardIds: newOppDiscard.slice(0, count) }
  }

  let newBlockClaim = state.blockClaim
  if (state.blockClaim?.player === opp) {
    const count = state.blockClaim.playedCardIds.length
    newBlockClaim = { ...state.blockClaim, playedCardIds: newOppDiscard.slice(0, count) }
  }

  return {
    ...state,
    [oppHandKey]: newOppHand,
    [oppDiscardKey]: newOppDiscard,
    deck: newDeck,
    attackClaim: newAttackClaim,
    blockClaim: newBlockClaim,
  }
}
