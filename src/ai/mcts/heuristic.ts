import type { GameState, Player } from '../../game/types'
import { getHand } from '../../game/types'
import { getCardByName, getCardById } from '../../game/cards'
import type { Action } from './types'

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

const ATTACKER_NAMES = ['Soldier', 'Archer', 'Wizard']

/**
 * Picks a realistic move without needing any learned knowledge.
 * Used as the fallback when the knowledge DB has no data for a situation,
 * so training games look like real human play rather than random noise.
 *
 * Attack heuristic:
 *   60% — truthful attack (play a real attacker, say what it is)
 *   25% — realistic bluff (play 1 card you have, claim a different type)
 *   15% — pass
 *
 * "Realistic bluff" mirrors what real players do: you have a Soldier but
 * claim Wizard to seem more threatening, or you hide a non-attacker card
 * behind a plausible single-card claim. Large multi-card bluffs are excluded
 * because they're easy to call and rarely seen in real play.
 */
export function pickHeuristicAction(state: GameState, player: Player, actions: Action[]): Action {
  const phase = state.turnPhase

  if (phase === 'attack') {
    const r = Math.random()

    if (r < 0.6) {
      // Truthful attack: prefer playing 1-2 real attacker cards
      const truthful = actions.filter((a) => a.type === 'attack' && a.truthful)
      if (truthful.length > 0) {
        // Prefer smaller truthful attacks (1-2 cards) — more realistic hand management
        const small = truthful.filter((a) => a.type === 'attack' && a.cardIds.length <= 2)
        return randomPick(small.length > 0 ? small : truthful)
      }
      // No real attacker in hand — fall through to bluff
    }

    if (r < 0.85) {
      // Realistic bluff: play exactly 1 card from hand, claim a different attacker type.
      // This mirrors how real players bluff — a single credible card, not a pile.
      const hand = getHand(state, player)
      const claimable = hand.filter((id) => {
        const card = getCardById(id)
        return card && !card.isUnclaimable
      })
      if (claimable.length > 0) {
        const cardId = randomPick(claimable)
        const card = getCardById(cardId)!
        // Pick a claimed name that doesn't match the actual card (making it a bluff)
        const otherNames = ATTACKER_NAMES.filter(
          (n) => n.toLowerCase() !== card.name.toLowerCase(),
        )
        if (otherNames.length > 0) {
          const claimedName = randomPick(otherNames)
          // Find this exact action in the legal actions list
          const bluffAction = actions.find(
            (a) =>
              a.type === 'attack' &&
              a.cardIds.length === 1 &&
              a.cardIds[0] === cardId &&
              a.claimedName === claimedName,
          )
          if (bluffAction) return bluffAction
        }
      }
    }

    // Pass (remaining ~15%, or if no good attack found)
    const passAction = actions.find((a) => a.type === 'pass')
    if (passAction) return passAction
    return randomPick(actions)
  }

  if (phase === 'block') {
    // Challenge is handled by deterministicAction — not included in actions here.
    const blockActions = actions.filter((a) => a.type === 'block')
    const truthfulBlocks = blockActions.filter((a) => a.type === 'block' && a.truthful)

    // 70% chance to block if you have a real blocker
    if (truthfulBlocks.length > 0 && Math.random() < 0.7) {
      return randomPick(truthfulBlocks)
    }

    return actions.find((a) => a.type === 'skipBlock') ?? randomPick(actions)
  }

  if (phase === 'resolve') {
    // Challenge is handled by deterministicAction — just resolve.
    return actions.find((a) => a.type === 'resolve') ?? randomPick(actions)
  }

  return randomPick(actions)
}
