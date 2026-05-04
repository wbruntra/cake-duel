import type { GameState, Player } from '../game/types'
import { opponent, getHand, getCakes } from '../game/types'
import { getCardByName, createDeck } from '../game/cards'
import type { Action, MCTSDifficulty } from './mcts/types'

const DECK_TOTALS: Record<string, number> = {}
for (const id of createDeck()) {
  DECK_TOTALS[id] = (DECK_TOTALS[id] ?? 0) + 1
}

function seenBy(state: GameState, player: Player, cardId: string): number {
  const discard = player === 'p1' ? state.p1Discard : state.p2Discard
  return (
    getHand(state, player).filter((id) => id === cardId).length +
    discard.filter((id) => id === cardId).length
  )
}

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

// P(claimer's hand has ≥ `count` of `claimedId`) from `observer`'s perspective.
// Must stay in sync with pClaimerCanHave in cpu-player.ts.
function pClaimerCanHave(
  state: GameState,
  observer: Player,
  claimedId: string,
  count: number,
): number {
  const claimer = opponent(observer)
  const available = (DECK_TOTALS[claimedId] ?? 0) - seenBy(state, observer, claimedId)
  if (available < count) return 0

  const claimerDiscard = (claimer === 'p1' ? state.p1Discard : state.p2Discard).length
  const poolSize = getHand(state, claimer).length + claimerDiscard + state.deck.length
  const handSize = getHand(state, claimer).length
  if (poolSize <= 0 || handSize <= 0) return 0

  let pLess = 0
  for (let k = 0; k < count; k++) pLess += hypergeomPMF(poolSize, available, handSize, k)
  return Math.max(0, 1 - pLess)
}

// Must stay in sync with STATISTICAL_CHALLENGE_THRESHOLD in cpu-player.ts.
const CHALLENGE_THRESHOLD = 0.4

function pWillChallenge(pCanHave: number): number {
  return Math.max(0, 1 - pCanHave / CHALLENGE_THRESHOLD)
}

// Total cakes in play — the stake if a challenge ends the bout.
function boutStake(state: GameState): number {
  return Math.max(4, state.p1Cakes + state.p2Cakes)
}

// Softmax sampling. Higher temperature = more random; lower = near-deterministic best pick.
function softmaxSample(scores: number[], temp: number): number {
  const max = Math.max(...scores)
  const exps = scores.map((s) => Math.exp((s - max) / temp))
  const total = exps.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < exps.length; i++) {
    r -= exps[i]!
    if (r <= 0) return i
  }
  return exps.length - 1
}

// Low temperature = near-optimal play; high temperature = more human-like variety.
const TEMPERATURES: Record<MCTSDifficulty, number> = {
  easy: 3.0,
  training: 0.5,
  medium: 0.7,
  hard: 0.15,
}

// Score an action in "expected cake delta" units.
//
// Key asymmetry this exploits:
//   Truthful attack: if challenged, attacker wins the bout — so challenges are upside.
//   Bluff attack:    if challenged, attacker loses the bout — so challenges are downside.
//   Truthful block:  if challenged, challenger loses the bout — so challenges are upside.
//   Bluff block:     if challenged, blocker loses the bout — so challenges are downside.
//
// This means truthful plays score their face value without a challenge penalty,
// while bluffs must discount by P(caught) × boutStake.
export function scoreAction(state: GameState, player: Player, action: Action): number {
  const myCakes = getCakes(state, player)
  const stake = boutStake(state)

  switch (action.type) {
    case 'attack': {
      const card = getCardByName(action.claimedName)
      if (!card) return -999
      const claimedCakes = card.cakesStolen * action.cardIds.length

      if (action.truthful) {
        return claimedCakes
      } else {
        const claimedId = action.claimedName.toLowerCase()
        const pC = pWillChallenge(
          pClaimerCanHave(state, opponent(player), claimedId, action.cardIds.length),
        )
        return claimedCakes * (1 - pC) - stake * pC
      }
    }

    case 'pass': {
      // deterministicAction handles the forced-win pass before scoring runs.
      // Otherwise passing is neutral; small bonus if already ahead.
      const oppCakes = getCakes(state, opponent(player))
      return (myCakes - oppCakes) * 0.15
    }

    case 'block': {
      if (!state.attackClaim) return -999
      const attackCard = getCardByName(state.attackClaim.cardName)
      if (!attackCard) return -999
      const blocksEffective = Math.min(action.cardIds.length, state.attackClaim.count)
      const cakesSaved = blocksEffective * attackCard.cakesStolen

      if (action.truthful) {
        return cakesSaved
      } else {
        const blockCardId = state.attackClaim.cardName === 'Wizard' ? 'scientist' : 'defender'
        const attackerPlayer = state.attackClaim.player
        const pC = pWillChallenge(
          pClaimerCanHave(state, attackerPlayer, blockCardId, action.cardIds.length),
        )
        return cakesSaved * (1 - pC) - stake * pC
      }
    }

    case 'skipBlock': {
      if (!state.attackClaim) return 0
      const attackCard = getCardByName(state.attackClaim.cardName)
      if (!attackCard) return 0
      const cakesLost = Math.min(myCakes, state.attackClaim.count * attackCard.cakesStolen)
      return -cakesLost
    }

    case 'challenge':
    case 'resolve':
      return 0
  }
}

export function pickScoredAction(
  state: GameState,
  player: Player,
  actions: Action[],
  difficulty: MCTSDifficulty = 'medium',
): { action: Action; scores: Array<{ action: Action; score: number }> } {
  if (actions.length === 0) throw new Error('No actions available')

  const scored = actions.map((a) => ({ action: a, score: scoreAction(state, player, a) }))

  if (actions.length === 1) return { action: actions[0]!, scores: scored }

  const temp = TEMPERATURES[difficulty]
  const idx = softmaxSample(
    scored.map((s) => s.score),
    temp,
  )
  return { action: actions[idx]!, scores: scored }
}
