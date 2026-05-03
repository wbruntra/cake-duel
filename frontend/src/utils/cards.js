const CARD_INFO = {
  soldier: {
    name: 'Soldier',
    type: 'weapon',
    cakes: 1,
    emoji: '⚔️',
    image:
      'https://wbruntra.us-iad-1.linodeobjects.com/generated-images/generated_2026-05-03T17-01-33-337Z.jpg',
  },
  archer: {
    name: 'Archer',
    type: 'weapon',
    cakes: 1,
    emoji: '🏹',
    image:
      'https://wbruntra.us-iad-1.linodeobjects.com/generated-images/generated_2026-05-03T17-07-33-522Z.jpg',
  },
  wizard: {
    name: 'Wizard',
    type: 'magic',
    cakes: 2,
    emoji: '🧙',
    image:
      'https://wbruntra.us-iad-1.linodeobjects.com/generated-images/generated_2026-05-03T17-07-49-654Z.jpg',
  },
  defender: {
    name: 'Defender',
    type: 'blocker',
    blocks: 1,
    blocksType: 'weapon',
    emoji: '🛡️',
    image:
      'https://wbruntra.us-iad-1.linodeobjects.com/generated-images/generated_2026-05-03T17-20-00-525Z.jpg',
  },
  scientist: {
    name: 'Scientist',
    type: 'blocker',
    blocks: 1,
    blocksType: 'magic',
    emoji: '🔬',
    image:
      'https://wbruntra.us-iad-1.linodeobjects.com/generated-images/generated_2026-05-03T17-20-09-904Z.jpg',
  },
  sir_wolfy: {
    name: 'Sir Wolfy',
    type: 'unclaimable',
    emoji: '🐺',
    image:
      'https://wbruntra.us-iad-1.linodeobjects.com/generated-images/generated_2026-05-03T17-20-22-716Z.jpg',
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

export const ATTACKER_NAMES = getAttackerOptions().map((o) => o.name)
export const BLOCKER_NAMES = Object.values(CARD_INFO)
  .filter((info) => info.type === 'blocker')
  .map((info) => info.name)
