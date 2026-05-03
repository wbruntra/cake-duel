import type { Card } from './types'

export const CORE_CARDS: Card[] = [
  {
    id: 'soldier',
    name: 'Soldier',
    type: 'weapon',
    cakesStolen: 1,
    blocks: 0,
    blockedBy: [],
    isUnclaimable: false,
    description: 'Steal one cake.',
  },
  {
    id: 'archer',
    name: 'Archer',
    type: 'weapon',
    cakesStolen: 1,
    blocks: 0,
    blockedBy: [],
    isUnclaimable: false,
    description: 'Steal one cake.',
  },
  {
    id: 'wizard',
    name: 'Wizard',
    type: 'magic',
    cakesStolen: 2,
    blocks: 0,
    blockedBy: [],
    isUnclaimable: false,
    description: 'Steal two cakes.',
  },
  {
    id: 'defender',
    name: 'Defender',
    type: 'blocker',
    cakesStolen: 0,
    blocks: 1,
    blockedBy: [],
    isUnclaimable: false,
    description: 'Block one Weapon from stealing cake(s).',
  },
  {
    id: 'scientist',
    name: 'Scientist',
    type: 'blocker',
    cakesStolen: 0,
    blocks: 1,
    blockedBy: [],
    isUnclaimable: false,
    description: 'Block one Magic from stealing cake(s).',
  },
  {
    id: 'sir_wolfy',
    name: 'Sir Wolfy',
    type: 'unclaimable',
    cakesStolen: 0,
    blocks: 0,
    blockedBy: [],
    isUnclaimable: true,
    description: 'At the end of the turn, reveal face-up and taunt your opponent.',
  },
]

export function getCardById(id: string): Card | undefined {
  return CORE_CARDS.find((c) => c.id === id)
}

export function getCardByName(name: string): Card | undefined {
  return CORE_CARDS.find((c) => c.name.toLowerCase() === name.toLowerCase())
}

export function getAttackerTypes(): Card['type'][] {
  return ['weapon', 'magic', 'special']
}

export function getBlockerTypes(): Card['type'][] {
  return ['blocker']
}

export function canBlock(blockerName: string, attackerType: string): boolean {
  const blocker = getCardByName(blockerName)
  if (!blocker || blocker.type !== 'blocker') return false

  if (blockerName === 'Defender') return attackerType === 'weapon'
  if (blockerName === 'Scientist') return attackerType === 'magic'

  return false
}

export function createDeck(): string[] {
  return [
    'soldier',
    'soldier',
    'soldier',
    'soldier',
    'soldier',
    'archer',
    'archer',
    'archer',
    'archer',
    'wizard',
    'wizard',
    'wizard',
    'defender',
    'defender',
    'defender',
    'defender',
    'scientist',
    'scientist',
    'scientist',
    'sir_wolfy',
  ]
}
