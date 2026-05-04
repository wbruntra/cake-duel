import type { GameState, Player } from '../../game/types'
import { opponent, getHand } from '../../game/types'
import type { Action } from './types'
import { getLegalActions } from './simulator'

interface ActionStats {
  wins: number
  visits: number
}

interface SituationStats {
  [actionKey: string]: ActionStats
}

interface KnowledgeDB {
  [situationKey: string]: SituationStats
}

let knowledge: KnowledgeDB = {}
let loaded = false
const KNOWLEDGE_FILE = Bun.env.KNOWLEDGE_FILE || 'cpu-knowledge.json'

function encodeHand(hand: string[]): string {
  const soldiers = hand.filter((id) => id === 'soldier').length
  const archers = hand.filter((id) => id === 'archer').length
  const wizards = hand.filter((id) => id === 'wizard').length
  const defenders = hand.filter((id) => id === 'defender').length
  const scientists = hand.filter((id) => id === 'scientist').length
  return `s:${soldiers},a:${archers},w:${wizards},d:${defenders},sc:${scientists}`
}

export function encodeSituation(state: GameState, player: Player): string {
  const phase = state.turnPhase
  const myCakes = state[player === 'p1' ? 'p1Cakes' : 'p2Cakes']
  const oppCakes = state[player === 'p1' ? 'p2Cakes' : 'p1Cakes']
  const myHand = getHand(state, player)
  const myDiscard = player === 'p1' ? state.p1Discard : state.p2Discard

  if (phase === 'attack') {
    const handCode = encodeHand(myHand)
    const passCtx = state.passedLast === opponent(player) ? 'oppPassed' : 'noPass'
    return [phase, myCakes, oppCakes, handCode, passCtx].join('|')
  }

  if (phase === 'block' && state.attackClaim) {
    const claimedId = state.attackClaim.cardName.toLowerCase()
    const blockerNeeded = state.attackClaim.cardName === 'Wizard' ? 'scientist' : 'defender'
    const haveBlockers = myHand.filter((id) => id === blockerNeeded).length
    const seenClaimed =
      myHand.filter((id) => id === claimedId).length +
      myDiscard.filter((id) => id === claimedId).length
    return [
      phase,
      myCakes,
      oppCakes,
      `at:${claimedId}${state.attackClaim.count}`,
      `hb:${haveBlockers}`,
      `seen:${seenClaimed}`,
    ].join('|')
  }

  if (phase === 'resolve') {
    if (!state.blockClaim) {
      return [phase, myCakes, oppCakes, 'noblock'].join('|')
    }
    const blockCardId = state.attackClaim?.cardName === 'Wizard' ? 'scientist' : 'defender'
    const seenBlocker =
      myHand.filter((id) => id === blockCardId).length +
      myDiscard.filter((id) => id === blockCardId).length
    return [
      phase,
      myCakes,
      oppCakes,
      `bc:${blockCardId}${state.blockClaim.count}`,
      `seen_blk:${seenBlocker}`,
    ].join('|')
  }

  return phase!
}

export function encodeAction(action: Action): string {
  switch (action.type) {
    case 'attack':
      return `attack|${action.claimedName}|${action.cardIds.length}|${action.truthful ? 'T' : 'B'}`
    case 'pass':
      return 'pass'
    case 'block':
      return `block|${action.cardIds.length}|${action.truthful ? 'T' : 'B'}`
    case 'skipBlock':
      return 'skip'
    case 'challenge':
      return `challenge|${action.target}`
    case 'resolve':
      return 'resolve'
  }
}

export function actionKeyForStateAndAction(
  state: GameState,
  player: Player,
  action: Action,
): string {
  return `${encodeSituation(state, player)}::${encodeAction(action)}`
}

import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { pickHeuristicAction } from './heuristic'

export function loadKnowledge(): void {
  if (loaded) return
  try {
    if (existsSync(KNOWLEDGE_FILE)) {
      const text = readFileSync(KNOWLEDGE_FILE, 'utf-8')
      knowledge = JSON.parse(text)
    } else {
      knowledge = {}
    }
  } catch {
    knowledge = {}
  }
  loaded = true
}

export function saveKnowledge(): void {
  writeFileSync(KNOWLEDGE_FILE, JSON.stringify(knowledge, null, 2))
}

export function recordResult(situationKey: string, actionKey: string, won: boolean): void {
  if (!knowledge[situationKey]) {
    knowledge[situationKey] = {}
  }
  const stats = knowledge[situationKey]![actionKey] ?? { wins: 0, visits: 0 }
  stats.visits++
  if (won) stats.wins++
  knowledge[situationKey]![actionKey] = stats
}

export function getStats(situationKey: string, actionKey: string): ActionStats {
  return knowledge[situationKey]?.[actionKey] ?? { wins: 0, visits: 0 }
}

export function bestActionKey(situationKey: string): string | null {
  const situations = knowledge[situationKey]
  if (!situations) return null
  let best: string | null = null
  let bestWinRate = -1
  for (const [key, stats] of Object.entries(situations)) {
    if (stats.visits >= 5) {
      const rate = stats.wins / stats.visits
      if (rate > bestWinRate) {
        bestWinRate = rate
        best = key
      }
    }
  }
  return best
}

export function knowledgeGuidedPick(state: GameState, player: Player, actions: Action[]): Action {
  loadKnowledge()

  const situation = encodeSituation(state, player)
  const scored = actions.map((a) => {
    const key = encodeAction(a)
    const stats = getStats(situation, key)
    return { action: a, stats, key }
  })

  const minVisits = 5
  const hasData = scored.some((s) => s.stats.visits >= minVisits)
  const epsilon = 0.15

  if (hasData && Math.random() > epsilon) {
    let best = scored[0]!
    for (const s of scored) {
      const sRate = s.stats.visits >= minVisits ? s.stats.wins / s.stats.visits : -1
      const bRate = best.stats.visits >= minVisits ? best.stats.wins / best.stats.visits : -1
      if (sRate > bRate) best = s
    }
    if (best.stats.visits >= minVisits) {
      return best.action
    }
  }

  // No knowledge for this situation yet — use the heuristic (85%) or explore
  // randomly (15%) rather than exploring purely at random. This keeps training
  // games realistic so the knowledge DB learns from human-like patterns.
  if (Math.random() < 0.85) {
    return pickHeuristicAction(state, player, actions)
  }
  return actions[Math.floor(Math.random() * actions.length)]!
}

export function knowledgeExplain(state: GameState, player: Player, actions: Action[]): string[] {
  loadKnowledge()
  const situation = encodeSituation(state, player)
  const lines: string[] = []

  const scored = actions.map((a) => {
    const key = encodeAction(a)
    const stats = getStats(situation, key)
    return { action: a, stats, key }
  })

  const minVisits = 5
  const withData = scored.filter((s) => s.stats.visits >= minVisits)
  lines.push(`  knowledge: situation=${situation} entries=${withData.length}/${scored.length}`)

  const sorted = [...withData].sort(
    (a, b) => b.stats.wins / b.stats.visits - a.stats.wins / a.stats.visits,
  )
  for (const s of sorted.slice(0, 5)) {
    const wr = s.stats.wins / s.stats.visits
    lines.push(`    ${s.key.padEnd(24)} WR=${wr.toFixed(2)} (${s.stats.wins}/${s.stats.visits})`)
  }

  return lines
}

export function getKnowledgeStats(): { situations: number; entries: number } {
  let entries = 0
  for (const sit of Object.values(knowledge)) {
    entries += Object.keys(sit).length
  }
  return { situations: Object.keys(knowledge).length, entries }
}
