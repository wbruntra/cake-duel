import type { GameState, Player } from '../../game/types'
import { opponent } from '../../game/types'
import { getLegalActions, applyAction, isBoutOver, getBoutWinner } from './simulator'
import { encodeSituation, encodeAction, recordResult, knowledgeGuidedPick } from './knowledge'
import { pickHeuristicAction } from './heuristic'

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
  return boutRollout(state, perspectivePlayer, (s, p, actions) =>
    pickHeuristicAction(s, p, actions),
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
