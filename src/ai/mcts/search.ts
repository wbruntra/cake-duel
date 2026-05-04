import type { GameState, Player } from '../../game/types'
import { opponent } from '../../game/types'
import { getLegalActions, applyAction, isBoutOver, getBoutWinner } from './simulator'
import { sampleDeterminization } from './determinizer'
import { MCTSNode } from './node'
import { randomRollout, heuristicRollout, knowledgeRollout } from './rollout'
import type { Action, MCTSConfig, MCTSResult } from './types'

const VERBOSE = !!Bun.env.CPU_VERBOSE

export function mctsSearch(state: GameState, player: Player, config: MCTSConfig): MCTSResult {
  const startTime = Date.now()
  const actions = getLegalActions(state, player)

  if (actions.length === 0) {
    throw new Error('No legal actions available')
  }

  if (actions.length === 1) {
    return {
      action: actions[0]!,
      winRate: 0,
      totalIterations: 0,
      timeMs: Date.now() - startTime,
    }
  }

  const root = new MCTSNode(null, null, opponent(player))

  for (let i = 0; i < config.iterations; i++) {
    const determinizedState = sampleDeterminization(state, player)
    const result = runIteration(determinizedState, root, player, config)
    backpropagate(result.node, result.winner, player)
  }

  const bestChild = root.mostVisitedChild()

  if (VERBOSE && root.children.length > 0) {
    const sorted = [...root.children].sort((a, b) => b.visits - a.visits)
    for (const c of sorted.slice(0, 5)) {
      const label = actionKey(c.action!)
      const wr = c.visits > 0 ? c.wins / c.visits : 0
      console.log(
        `  [MCTS]  ${label.padEnd(28)} visits=${c.visits} wins=${c.wins} WR=${wr.toFixed(3)}`,
      )
    }
  }

  return {
    action: bestChild.action!,
    winRate: bestChild.visits > 0 ? bestChild.wins / bestChild.visits : 0,
    totalIterations: config.iterations,
    timeMs: Date.now() - startTime,
  }
}

function runIteration(
  state: GameState,
  root: MCTSNode,
  perspectivePlayer: Player,
  config: MCTSConfig,
): { node: MCTSNode; winner: Player | null } {
  let node = root
  let current = { ...state }

  // Selection: descend the tree while the current node is fully expanded
  while (!isBoutOver(current)) {
    const legalActions = getLegalActions(current, current.turnPlayer!)
    const triedKeys = new Set(node.children.map((c) => actionKey(c.action!)))
    const hasUntried = legalActions.some((la) => !triedKeys.has(actionKey(la)))

    if (hasUntried || node.children.length === 0) break

    const legalKeySet = new Set(legalActions.map(actionKey))
    const validChildren = node.children.filter((c) => legalKeySet.has(actionKey(c.action!)))
    if (validChildren.length === 0) break

    node = validChildren.reduce((best, child) =>
      child.ucb1(config.explorationConstant) > best.ucb1(config.explorationConstant)
        ? child
        : best,
    )
    current = applyAction(current, node.playerJustMoved, node.action!)
  }

  // Expansion: pick a random untried action type and add a child
  if (!isBoutOver(current)) {
    const legalActions = getLegalActions(current, current.turnPlayer!)
    const triedKeys = new Set(node.children.map((c) => actionKey(c.action!)))
    const untriedLegal = legalActions.filter((la) => !triedKeys.has(actionKey(la)))

    if (untriedLegal.length > 0) {
      const action = untriedLegal[Math.floor(Math.random() * untriedLegal.length)]!
      const nextPlayer = current.turnPlayer!
      current = applyAction(current, nextPlayer, action)
      node = node.addChild(action, nextPlayer)
    }
  }

  const rolloutFn =
    config.rolloutPolicy === 'heuristic'
      ? heuristicRollout
      : config.rolloutPolicy === 'knowledge'
        ? knowledgeRollout
        : randomRollout

  const winner = resolveRollout(current, perspectivePlayer, rolloutFn)

  return { node, winner }
}

export function actionKey(action: Action): string {
  switch (action.type) {
    case 'attack':
      return `attack|${action.claimedName}|${action.cardIds.length}|${action.truthful ? 'T' : 'B'}`
    case 'block':
      return `block|${action.cardIds.length}|${action.truthful ? 'T' : 'B'}`
    case 'pass':
      return 'pass'
    case 'skipBlock':
      return 'skipBlock'
    case 'challenge':
      return `challenge|${action.target}`
    case 'resolve':
      return 'resolve'
  }
}

function resolveRollout(
  state: GameState,
  perspectivePlayer: Player,
  rolloutFn: (state: GameState, player: Player) => number,
): Player | null {
  if (isBoutOver(state)) {
    return getBoutWinner(state)
  }
  const score = rolloutFn(state, perspectivePlayer)
  if (score === 1) return perspectivePlayer
  if (score === 0.5) return null
  return opponent(perspectivePlayer)
}

function backpropagate(node: MCTSNode, winner: Player | null, perspectivePlayer: Player): void {
  let current: MCTSNode | null = node
  while (current) {
    current.visits++
    if (winner === perspectivePlayer) {
      if (current.playerJustMoved === perspectivePlayer) {
        current.wins += 1
      }
    } else if (winner === opponent(perspectivePlayer)) {
      if (current.playerJustMoved === opponent(perspectivePlayer)) {
        current.wins += 1
      }
    }
    current = current.parent
  }
}
