import type { GameState, Player } from '../../game/types'
import { opponent } from '../../game/types'
import { getCardByName, getCardById } from '../../game/cards'
import { getLegalActions, applyAction, isBoutOver, getBoutWinner } from './simulator'
import { encodeSituation, encodeAction, recordResult, knowledgeGuidedPick } from './knowledge'

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function boutRollout(
  state: GameState,
  perspectivePlayer: Player,
  pickFn: (
    state: GameState,
    player: Player,
    actions: import('./types').Action[],
  ) => import('./types').Action,
): number {
  let current = state
  let iterations = 0
  const maxIterations = 100

  while (!isBoutOver(current) && iterations < maxIterations) {
    const actions = getLegalActions(current, current.turnPlayer!)
    if (actions.length === 0) break

    const action = pickFn(current, current.turnPlayer!, actions)
    current = applyAction(current, current.turnPlayer!, action)
    iterations++
  }

  const winner = getBoutWinner(current)
  if (winner === perspectivePlayer) return 1
  if (winner === null) return 0.5
  return 0
}

export function randomRollout(state: GameState, perspectivePlayer: Player): number {
  return boutRollout(state, perspectivePlayer, (_s, _p, actions) => randomPick(actions))
}

export function heuristicRollout(state: GameState, perspectivePlayer: Player): number {
  return boutRollout(state, perspectivePlayer, (_s, _p, actions) =>
    pickHeuristicAction(_s, _p, actions),
  )
}

export function knowledgeRollout(state: GameState, perspectivePlayer: Player): number {
  return boutRollout(state, perspectivePlayer, (_s, _p, actions) =>
    knowledgeGuidedPick(_s, _p, actions),
  )
}

export function knowledgeLearningRollout(
  state: GameState,
  perspectivePlayer: Player,
): { winner: Player | null; records: Array<{ situationKey: string; actionKey: string }> } {
  let current = state
  let iterations = 0
  const maxIterations = 100
  const records: Array<{ situationKey: string; actionKey: string }> = []

  while (!isBoutOver(current) && iterations < maxIterations) {
    const actions = getLegalActions(current, current.turnPlayer!)
    if (actions.length === 0) break

    const activePlayer = current.turnPlayer!
    const action = knowledgeGuidedPick(current, activePlayer, actions)

    if (activePlayer === perspectivePlayer) {
      records.push({
        situationKey: encodeSituation(current, activePlayer),
        actionKey: encodeAction(action),
      })
    }

    current = applyAction(current, activePlayer, action)
    iterations++
  }

  return { winner: getBoutWinner(current), records }
}

function pickHeuristicAction(
  state: GameState,
  player: Player,
  actions: import('./types').Action[],
): import('./types').Action {
  const phase = state.turnPhase

  if (phase === 'attack') {
    const attacks = actions.filter((a) => a.type === 'attack')
    if (attacks.length > 0) {
      if (Math.random() < 0.8) {
        const truthful = attacks.filter((a) => a.type === 'attack' && a.truthful)
        if (truthful.length > 0 && Math.random() < 0.7) {
          return randomPick(truthful)
        }
      }
      return randomPick(attacks)
    }
    return actions.find((a) => a.type === 'pass')!
  }

  if (phase === 'block') {
    const challengeAction = actions.find((a) => a.type === 'challenge' && a.target === 'attack')
    if (challengeAction && state.attackClaim) {
      const attackerCount = state.attackClaim.count
      const attackerName = state.attackClaim.cardName
      const attackerCard = getCardByName(attackerName)
      if (attackerCard) {
        if (attackerCount >= 3 || (attackerCount >= 2 && attackerCard.cakesStolen >= 2)) {
          if (Math.random() < 0.3) return challengeAction
        }
        if (Math.random() < 0.15) return challengeAction
      }
    }

    const blockActions = actions.filter((a) => a.type === 'block')
    if (blockActions.length > 0 && Math.random() < 0.6) {
      return randomPick(blockActions)
    }

    return actions.find((a) => a.type === 'skipBlock')!
  }

  if (phase === 'resolve') {
    const challengeBlock = actions.find((a) => a.type === 'challenge' && a.target === 'block')
    if (challengeBlock && state.blockClaim) {
      const blockCount = state.blockClaim.count
      if (blockCount >= 2 && Math.random() < 0.3) {
        return challengeBlock
      }
      if (Math.random() < 0.1) return challengeBlock
    }
    return actions.find((a) => a.type === 'resolve')!
  }

  return randomPick(actions)
}
