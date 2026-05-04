import type { GameState, Player } from '../../game/types'
import { opponent, getHand } from '../../game/types'

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
  const oppHand = state[opp === 'p1' ? 'p1Hand' : 'p2Hand']

  // Only randomize the opponent's hand and the deck — NOT already-played
  // face-down cards. Those cards were committed by the opponent and the MCTS
  // needs to know their actual identity to correctly evaluate challenges.
  // Randomizing played cards makes every attack look like a bluff in simulation,
  // causing the CPU to challenge truthful claims and lose every time.
  const pool: string[] = [...oppHand, ...state.deck]

  if (pool.length === 0) return { ...state }

  const shuffled = shuffle(pool)

  let offset = 0
  const newOppHand = shuffled.slice(offset, (offset += oppHand.length))
  const newDeck = shuffled.slice(offset, (offset += state.deck.length))

  return {
    ...state,
    [opp === 'p1' ? 'p1Hand' : 'p2Hand']: newOppHand,
    deck: newDeck,
  }
}
