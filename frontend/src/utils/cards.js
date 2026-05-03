const CARD_INFO = {
  soldier: {
    name: 'Soldier',
    type: 'weapon',
    cakes: 1,
    emoji: '⚔️',
    image: '/cards/soldier.webp',
  },
  archer: {
    name: 'Archer',
    type: 'weapon',
    cakes: 1,
    emoji: '🏹',
    image: '/cards/archer.webp',
  },
  wizard: {
    name: 'Wizard',
    type: 'magic',
    cakes: 2,
    emoji: '🧙',
    image: '/cards/wizard.webp',
  },
  defender: {
    name: 'Defender',
    type: 'blocker',
    blocks: 1,
    blocksType: 'weapon',
    emoji: '🛡️',
    image: '/cards/defender.webp',
  },
  scientist: {
    name: 'Scientist',
    type: 'blocker',
    blocks: 1,
    blocksType: 'magic',
    emoji: '🔬',
    image: '/cards/scientist.webp',
  },
  sir_wolfy: {
    name: 'Sir Wolfy',
    type: 'unclaimable',
    emoji: '🐺',
    image: '/cards/sir_wolfy.webp',
  },
}

export function getCardInfo(idOrName) {
  if (CARD_INFO[idOrName]) return CARD_INFO[idOrName]
  const lower = idOrName.toLowerCase()
  const match = Object.entries(CARD_INFO).find(
    ([id]) => id === lower || CARD_INFO[id].name.toLowerCase() === lower,
  )
  return match ? match[1] : { name: idOrName, type: 'unknown', emoji: '❓' }
}

export function getAttackerOptions() {
  return Object.entries(CARD_INFO)
    .filter(([, info]) => info.type === 'weapon' || info.type === 'magic')
    .map(([id, info]) => ({
      id,
      name: info.name,
      cakes: info.cakes,
      emoji: info.emoji,
      image: info.image,
    }))
}

export function getBlockerOptions(attackerType) {
  return Object.entries(CARD_INFO)
    .filter(([, info]) => info.type === 'blocker' && info.blocksType === attackerType)
    .map(([id, info]) => ({ id, name: info.name, emoji: info.emoji }))
}

export function getBlockerName(attackerType) {
  if (attackerType === 'weapon') return { name: 'Defender', emoji: '🛡️', blocks: 1 }
  if (attackerType === 'magic') return { name: 'Scientist', emoji: '🔬', blocks: 1 }
  return null
}

export function getCardTypeLabel(type) {
  const labels = {
    weapon: 'Weapon',
    magic: 'Magic',
    blocker: 'Blocker',
    unclaimable: 'Unclaimable',
  }
  return labels[type] || type
}

export const CARD_BACK_IMAGE = '/cards/card-back.svg'

export const ATTACKER_NAMES = getAttackerOptions().map((o) => o.name)
export const BLOCKER_NAMES = Object.values(CARD_INFO)
  .filter((info) => info.type === 'blocker')
  .map((info) => info.name)
