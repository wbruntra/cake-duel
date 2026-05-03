export type CardType = 'weapon' | 'magic' | 'special' | 'blocker' | 'unclaimable'
export type TurnPhase = 'attack' | 'block' | 'resolve' | 'resupply' | 'bout_end' | 'game_over'
export type GameStatus = 'waiting' | 'playing' | 'finished'
export type Player = 'p1' | 'p2'

export interface Card {
  id: string
  name: string
  type: CardType
  cakesStolen: number
  blocks: number
  blockedBy: CardType[]
  isUnclaimable: boolean
  description: string
}

export interface Claim {
  cardName: string
  count: number
  player: Player
  playedCardIds: string[]
}

export interface GameState {
  id: string
  status: GameStatus
  player1Id: string
  player2Id: string | null
  currentBout: number
  boutWinners: (string | null)[]
  winner: string | null
  turnPlayer: Player | null
  turnPhase: TurnPhase | null
  p1Hand: string[]
  p2Hand: string[]
  p1Cakes: number
  p2Cakes: number
  p1HandSize: number
  p2HandSize: number
  deck: string[]
  discard: string[]
  attackClaim: Claim | null
  blockClaim: Claim | null
  passedLast: Player | null
  boutEndAcks: Player[]
}

export function getHand(state: GameState, player: Player): string[] {
  return player === 'p1' ? state.p1Hand : state.p2Hand
}

export function getCakes(state: GameState, player: Player): number {
  return player === 'p1' ? state.p1Cakes : state.p2Cakes
}

export function getHandSize(state: GameState, player: Player): number {
  return player === 'p1' ? state.p1HandSize : state.p2HandSize
}

export function opponent(player: Player): Player {
  return player === 'p1' ? 'p2' : 'p1'
}
