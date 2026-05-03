import type { GameState, Player, Claim, ChallengeResult, TurnResult } from './types'
import { opponent, getCakes, getHand } from './types'
import { getCardByName, getCardById, createDeck, getAttackerTypes } from './cards'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

function drawCards(deck: string[], count: number): { drawn: string[]; deck: string[] } {
  const remaining = [...deck]
  const drawn = []
  for (let i = 0; i < count && remaining.length > 0; i++) {
    drawn.push(remaining.shift()!)
  }
  return { drawn, deck: remaining }
}

function removeFromHand(hand: string[], cardIds: string[]): string[] | null {
  const remaining = [...hand]
  for (const id of cardIds) {
    const idx = remaining.indexOf(id)
    if (idx === -1) return null
    remaining.splice(idx, 1)
  }
  return remaining
}

export function newBout(state: GameState, startingPlayer: Player): GameState {
  const deck = shuffle(createDeck())
  const { drawn: p1, deck: d1 } = drawCards(deck, state.p1HandSize)
  const { drawn: p2, deck: d2 } = drawCards(d1, state.p2HandSize)

  return {
    ...state,
    status: 'playing',
    p1Hand: p1,
    p2Hand: p2,
    p1Cakes: 3,
    p2Cakes: 4,
    deck: d2,
    discard: [],
    attackClaim: null,
    blockClaim: null,
    passedLast: null,
    turnPlayer: startingPlayer,
    turnPhase: 'attack',
    lastTurnResult: null,
    challengeResult: null,
    challengeAcks: [],
    boutEndAcks: [],
    turnAcks: [],
  }
}

export function playAttack(
  state: GameState,
  player: Player,
  cardIds: string[],
  claimedName: string,
): { state: GameState; error?: string } {
  if (state.turnPlayer !== player) return { state, error: 'Not your turn' }
  if (state.turnPhase !== 'attack') return { state, error: 'Not in attack phase' }
  if (cardIds.length === 0) return { state, error: 'Must play at least one card' }

  const hand = getHand(state, player)
  const newHand = removeFromHand(hand, cardIds)
  if (!newHand) return { state, error: 'Cards not in hand' }

  const card = getCardByName(claimedName)
  if (!card) return { state, error: `Unknown card: ${claimedName}` }
  if (card.isUnclaimable) return { state, error: `${claimedName} cannot be claimed` }
  if (!getAttackerTypes().includes(card.type))
    return { state, error: `${claimedName} is not an attacker` }

  const claim: Claim = {
    cardName: claimedName,
    count: cardIds.length,
    player,
    playedCardIds: cardIds,
  }

  return {
    state: {
      ...state,
      [player === 'p1' ? 'p1Hand' : 'p2Hand']: newHand,
      discard: [...state.discard, ...cardIds],
      attackClaim: claim,
      passedLast: null,
      turnPhase: 'block',
      turnPlayer: opponent(player),
      lastTurnResult: null,
    },
  }
}

function getBlockerForAttack(attackTypeName: string): string | null {
  if (attackTypeName === 'weapon') return 'Defender'
  if (attackTypeName === 'magic') return 'Scientist'
  return null
}

export function playBlock(
  state: GameState,
  player: Player,
  cardIds: string[],
): { state: GameState; error?: string } {
  if (state.turnPlayer !== player) return { state, error: 'Not your turn' }
  if (state.turnPhase !== 'block') return { state, error: 'Not in block phase' }
  if (!state.attackClaim) return { state, error: 'Nothing to block' }
  if (cardIds.length === 0) return { state, error: 'Must play at least one card' }

  const attackCard = getCardByName(state.attackClaim.cardName)
  if (!attackCard) return { state, error: 'Invalid attack claim' }

  const claimedName = getBlockerForAttack(attackCard.type)
  if (!claimedName) return { state, error: 'Cannot block this attack type' }

  const hand = getHand(state, player)
  const newHand = removeFromHand(hand, cardIds)
  if (!newHand) return { state, error: 'Cards not in hand' }

  const blockCard = getCardByName(claimedName)
  const claim: Claim = {
    cardName: claimedName,
    count: cardIds.length,
    player,
    playedCardIds: cardIds,
  }

  return {
    state: {
      ...state,
      [player === 'p1' ? 'p1Hand' : 'p2Hand']: newHand,
      discard: [...state.discard, ...cardIds],
      blockClaim: claim,
      turnPhase: 'resolve',
    },
  }
}

export function skipBlock(state: GameState, player: Player): { state: GameState; error?: string } {
  if (state.turnPlayer !== player) return { state, error: 'Not your turn' }
  if (state.turnPhase !== 'block') return { state, error: 'Not in block phase' }

  return {
    state: {
      ...state,
      turnPhase: 'resolve',
    },
  }
}

export function pass(
  state: GameState,
  player: Player,
): { state: GameState; error?: string; doublePass?: boolean } {
  if (state.turnPlayer !== player) return { state, error: 'Not your turn' }
  if (state.turnPhase !== 'attack') return { state, error: 'Not in attack phase' }

  const doublePass = state.passedLast === opponent(player)

  return {
    state: {
      ...state,
      passedLast: player,
      attackClaim: null,
      turnPlayer: opponent(player),
      turnPhase: 'attack',
      lastTurnResult: null,
    },
    doublePass,
  }
}

export function resolveTurn(state: GameState): {
  state: GameState
  turnResult: TurnResult
  boutOver: boolean
  attackerWins: boolean
} {
  if (!state.attackClaim) {
    return {
      state,
      turnResult: {
        attackClaim: null as any,
        blockClaim: null,
        cakesStolen: 0,
        defenderCakes: 0,
        boutOver: false,
      },
      boutOver: false,
      attackerWins: false,
    }
  }

  const attackCard = getCardByName(state.attackClaim.cardName)!
  let attackersRemaining = state.attackClaim.count

  if (state.blockClaim) {
    const blockCard = getCardByName(state.blockClaim.cardName)!
    const totalBlocks = blockCard.blocks * state.blockClaim.count
    attackersRemaining = Math.max(0, state.attackClaim.count - totalBlocks)
  }

  const stolen = attackersRemaining * attackCard.cakesStolen

  const attacker = state.attackClaim.player
  const defender = opponent(attacker)
  const defenderCakes = getCakes(state, defender)
  const actuallyStolen = Math.min(stolen, defenderCakes)

  const next: GameState = {
    ...state,
    [attacker === 'p1' ? 'p1Cakes' : 'p2Cakes']: getCakes(state, attacker) + actuallyStolen,
    [defender === 'p1' ? 'p1Cakes' : 'p2Cakes']: defenderCakes - actuallyStolen,
  }

  const boutOver = getCakes(next, defender) <= 0
  const attackerWins = boutOver

  const turnResult: TurnResult = {
    attackClaim: state.attackClaim,
    blockClaim: state.blockClaim,
    cakesStolen: actuallyStolen,
    defenderCakes: defenderCakes - actuallyStolen,
    boutOver,
  }

  return { state: next, turnResult, boutOver, attackerWins }
}

export function toTurnResolution(state: GameState, turnResult: TurnResult): GameState {
  return {
    ...state,
    turnPhase: 'turn_resolution',
    lastTurnResult: turnResult,
    turnAcks: [],
  }
}

export function ackTurnResolution(
  state: GameState,
  player: Player,
): { state: GameState; bothAcked: boolean; error?: string } {
  if (state.turnPhase !== 'turn_resolution') {
    return { state, bothAcked: false, error: 'Not in turn_resolution phase' }
  }
  const acks = state.turnAcks.includes(player) ? state.turnAcks : [...state.turnAcks, player]
  return {
    state: { ...state, turnAcks: acks },
    bothAcked: acks.length === 2,
  }
}

export function resupply(state: GameState): GameState {
  let { deck } = state
  if (!state.attackClaim)
    return {
      ...state,
      turnPhase: 'attack',
      turnPlayer: opponent(state.turnPlayer!),
      lastTurnResult: null,
      turnAcks: [],
    }

  const attacker = state.attackClaim.player
  const defender = opponent(attacker)

  const attHand = [...getHand(state, attacker)]
  const defHand = [...getHand(state, defender)]
  const attSize = state[attacker === 'p1' ? 'p1HandSize' : 'p2HandSize']
  const defSize = state[defender === 'p1' ? 'p1HandSize' : 'p2HandSize']

  const { drawn: aDraw, deck: d1 } = drawCards(deck, Math.max(0, attSize - attHand.length))
  attHand.push(...aDraw)

  const { drawn: dDraw, deck: d2 } = drawCards(d1, Math.max(0, defSize - defHand.length))
  defHand.push(...dDraw)

  return {
    ...state,
    deck: d2,
    [attacker === 'p1' ? 'p1Hand' : 'p2Hand']: attHand,
    [defender === 'p1' ? 'p1Hand' : 'p2Hand']: defHand,
    turnPhase: 'attack',
    turnPlayer: opponent(attacker),
    attackClaim: null,
    blockClaim: null,
    lastTurnResult: null,
    turnAcks: [],
  }
}

export function finishBout(state: GameState, boutWinner: Player): GameState {
  const boutIndex = state.currentBout - 1
  const newWinners = [...state.boutWinners]
  newWinners[boutIndex] = boutWinner

  const p1Wins = newWinners.filter((w) => w === 'p1').length
  const p2Wins = newWinners.filter((w) => w === 'p2').length

  if (p1Wins >= 3 || p2Wins >= 3) {
    return {
      ...state,
      boutWinners: newWinners,
      winner: p1Wins >= 3 ? 'p1' : 'p2',
      status: 'finished',
      turnPhase: 'game_over',
    }
  }

  return {
    ...state,
    boutWinners: newWinners,
    turnPhase: 'bout_end',
    boutEndAcks: [],
  }
}

export function startNextBout(state: GameState): GameState {
  const lastWinner = state.boutWinners[state.currentBout - 1] as Player
  const loser = opponent(lastWinner)
  return newBout(
    {
      ...state,
      currentBout: state.currentBout + 1,
      boutEndAcks: [],
    },
    loser,
  )
}

export function ackBoutEnd(
  state: GameState,
  player: Player,
): { state: GameState; bothAcked: boolean; error?: string } {
  if (state.turnPhase !== 'bout_end') {
    return { state, bothAcked: false, error: 'Not in bout_end phase' }
  }
  const acks = state.boutEndAcks.includes(player)
    ? state.boutEndAcks
    : [...state.boutEndAcks, player]
  return {
    state: { ...state, boutEndAcks: acks },
    bothAcked: acks.length === 2,
  }
}

export function endBout(state: GameState, boutWinner: Player): GameState {
  const afterFinish = finishBout(state, boutWinner)
  if (afterFinish.status === 'finished') return afterFinish
  return startNextBout(afterFinish)
}

export function checkDoublePass(state: GameState): boolean {
  if (state.passedLast && !state.attackClaim) {
    return true
  }
  return false
}

export function determineBoutWinnerOnPass(state: GameState): Player {
  if (state.p1Cakes > state.p2Cakes) return 'p1'
  if (state.p2Cakes > state.p1Cakes) return 'p2'
  return state.turnPlayer === 'p1' ? 'p2' : 'p1'
}

function isClaimTruthful(claim: Claim): boolean {
  return claim.playedCardIds.every(
    (id) => getCardById(id)?.name.toLowerCase() === claim.cardName.toLowerCase(),
  )
}

export function resolveChallenge(
  state: GameState,
  challenger: Player,
  target: 'attack' | 'block',
): { state: GameState; challengeResult: ChallengeResult } | { state: GameState; error: string } {
  if (target === 'attack') {
    if (state.turnPhase !== 'block')
      return { state, error: 'Can only challenge an attack during block phase' }
    if (state.turnPlayer !== challenger) return { state, error: 'Not your turn' }
    if (!state.attackClaim) return { state, error: 'No attack claim to challenge' }
    const claimWasTruthful = isClaimTruthful(state.attackClaim)
    const boutWinner: Player = claimWasTruthful ? state.attackClaim.player : challenger
    const revealedCardNames = state.attackClaim.playedCardIds.map(
      (id) => getCardById(id)?.name ?? 'Unknown',
    )
    return {
      state,
      challengeResult: {
        target,
        challenger,
        claimWasTruthful,
        boutWinner,
        revealedCardNames,
      },
    }
  }

  if (state.turnPhase !== 'resolve')
    return { state, error: 'Can only challenge a block during resolve phase' }
  if (!state.attackClaim) return { state, error: 'No attack claim on record' }
  if (state.attackClaim.player !== challenger)
    return { state, error: 'Only the attacker can challenge a block' }
  if (!state.blockClaim) return { state, error: 'No block claim to challenge' }
  const claimWasTruthful = isClaimTruthful(state.blockClaim)
  const boutWinner: Player = claimWasTruthful ? state.blockClaim.player : challenger
  const revealedCardNames = state.blockClaim.playedCardIds.map(
    (id) => getCardById(id)?.name ?? 'Unknown',
  )
  return {
    state,
    challengeResult: {
      target,
      challenger,
      claimWasTruthful,
      boutWinner,
      revealedCardNames,
    },
  }
}

export function toChallengeResult(state: GameState, challengeResult: ChallengeResult): GameState {
  return {
    ...state,
    turnPhase: 'challenge_result',
    challengeResult,
    challengeAcks: [],
  }
}

export function ackChallengeResult(
  state: GameState,
  player: Player,
): { state: GameState; bothAcked: boolean; error?: string } {
  if (state.turnPhase !== 'challenge_result') {
    return { state, bothAcked: false, error: 'Not in challenge_result phase' }
  }
  const acks = state.challengeAcks.includes(player)
    ? state.challengeAcks
    : [...state.challengeAcks, player]
  return {
    state: { ...state, challengeAcks: acks },
    bothAcked: acks.length === 2,
  }
}

export function stateForPlayer(state: GameState, player: Player) {
  const opp = opponent(player)
  return {
    id: state.id,
    status: state.status,
    currentBout: state.currentBout,
    boutWinners: state.boutWinners,
    winner: state.winner,
    turnPlayer: state.turnPlayer,
    turnPhase: state.turnPhase,
    hand: state[player === 'p1' ? 'p1Hand' : 'p2Hand'],
    opponentHandCount: state[opp === 'p1' ? 'p1Hand' : 'p2Hand'].length,
    myCakes: state[player === 'p1' ? 'p1Cakes' : 'p2Cakes'],
    opponentCakes: state[opp === 'p1' ? 'p1Cakes' : 'p2Cakes'],
    myHandSize: state[player === 'p1' ? 'p1HandSize' : 'p2HandSize'],
    deckCount: state.deck.length,
    attackClaim: state.attackClaim,
    blockClaim: state.blockClaim,
    boutEndAcks: state.boutEndAcks,
    challengeResult: state.challengeResult
      ? getChallengeResultForPlayer(state.challengeResult, player)
      : null,
    challengeAcks: state.challengeAcks,
    turnAcks: state.turnAcks,
    lastTurnResult: state.lastTurnResult
      ? {
          attackClaim: state.lastTurnResult.attackClaim,
          blockClaim: state.lastTurnResult.blockClaim,
          cakesStolen: state.lastTurnResult.cakesStolen,
          defenderCakes: state.lastTurnResult.defenderCakes,
          boutOver: state.lastTurnResult.boutOver,
          iStoleCakes: state.lastTurnResult.attackClaim.player === player,
        }
      : null,
    player,
  }
}

function getChallengeResultForPlayer(result: ChallengeResult, player: Player) {
  return {
    target: result.target,
    challenger: result.challenger,
    claimWasTruthful: result.claimWasTruthful,
    boutWinner: result.boutWinner,
    revealedCardNames: result.revealedCardNames,
    iChallenged: result.challenger === player,
    iWon: result.boutWinner === player,
  }
}
