import type { GameState, Player } from '../../game/types'
import type { Action } from './types'

export class MCTSNode {
  action: Action | null
  parent: MCTSNode | null
  children: MCTSNode[]
  wins: number
  visits: number
  playerJustMoved: Player

  constructor(action: Action | null, parent: MCTSNode | null, playerJustMoved: Player) {
    this.action = action
    this.parent = parent
    this.children = []
    this.wins = 0
    this.visits = 0
    this.playerJustMoved = playerJustMoved
  }

  ucb1(explorationConstant: number): number {
    if (this.visits === 0) return Infinity
    return (
      this.wins / this.visits +
      explorationConstant * Math.sqrt(Math.log(this.parent!.visits) / this.visits)
    )
  }

  bestChild(explorationConstant: number): MCTSNode {
    let best = this.children[0]!
    let bestScore = -Infinity
    for (const child of this.children) {
      const score = child.ucb1(explorationConstant)
      if (score > bestScore) {
        bestScore = score
        best = child
      }
    }
    return best
  }

  mostVisitedChild(): MCTSNode {
    let best = this.children[0]!
    for (const child of this.children) {
      if (child.visits > best.visits) {
        best = child
      }
    }
    return best
  }

  addChild(action: Action, playerJustMoved: Player): MCTSNode {
    const child = new MCTSNode(action, this, playerJustMoved)
    this.children.push(child)
    return child
  }
}
