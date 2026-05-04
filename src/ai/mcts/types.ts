import type { Player } from '../../game/types'

export type Action =
  | { type: 'attack'; cardIds: string[]; claimedName: string; truthful: boolean }
  | { type: 'pass' }
  | { type: 'block'; cardIds: string[]; truthful: boolean }
  | { type: 'skipBlock' }
  | { type: 'challenge'; target: 'attack' | 'block' }
  | { type: 'resolve' }

export type MCTSDifficulty = 'easy' | 'training' | 'medium' | 'hard'

export interface MCTSConfig {
  iterations: number
  explorationConstant: number
  rolloutPolicy: 'random' | 'heuristic' | 'knowledge'
}

export const DIFFICULTY_CONFIGS: Record<MCTSDifficulty, MCTSConfig> = {
  easy: { iterations: 100, explorationConstant: Math.SQRT2, rolloutPolicy: 'random' },
  training: { iterations: 100, explorationConstant: Math.SQRT2, rolloutPolicy: 'knowledge' },
  medium: { iterations: 1000, explorationConstant: Math.SQRT2, rolloutPolicy: 'knowledge' },
  hard: { iterations: 5000, explorationConstant: Math.SQRT2, rolloutPolicy: 'knowledge' },
}

export interface MCTSResult {
  action: Action
  winRate: number
  totalIterations: number
  timeMs: number
}
