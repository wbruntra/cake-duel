const CARD_INFO = {
  soldier: { name: "Soldier", type: "weapon", cakes: 1, emoji: "⚔️" },
  archer: { name: "Archer", type: "weapon", cakes: 1, emoji: "🏹" },
  wizard: { name: "Wizard", type: "magic", cakes: 2, emoji: "🧙" },
  defender: { name: "Defender", type: "blocker", blocks: 1, blocksType: "weapon", emoji: "🛡️" },
  scientist: { name: "Scientist", type: "blocker", blocks: 1, blocksType: "magic", emoji: "🔬" },
  sir_wolfy: { name: "Sir Wolfy", type: "unclaimable", emoji: "🐺" },
};

export function getCardInfo(id) {
  return CARD_INFO[id] || { name: id, type: "unknown", emoji: "❓" };
}

export function getAttackerOptions() {
  return Object.entries(CARD_INFO)
    .filter(([, info]) => info.type === "weapon" || info.type === "magic")
    .map(([id, info]) => ({ id, name: info.name, cakes: info.cakes, emoji: info.emoji }));
}

export function getBlockerOptions(attackerType) {
  return Object.entries(CARD_INFO)
    .filter(([, info]) => info.type === "blocker" && info.blocksType === attackerType)
    .map(([id, info]) => ({ id, name: info.name, emoji: info.emoji }));
}

export function getCardTypeLabel(type) {
  const labels = { weapon: "Weapon", magic: "Magic", blocker: "Blocker", unclaimable: "Unclaimable" };
  return labels[type] || type;
}

export const ATTACKER_NAMES = getAttackerOptions().map((o) => o.name);
export const BLOCKER_NAMES = Object.values(CARD_INFO)
  .filter((info) => info.type === "blocker")
  .map((info) => info.name);
