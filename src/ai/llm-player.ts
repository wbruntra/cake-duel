import type { GameState, Player } from '../game/types'
import { OPENROUTER_API_KEY } from '~/secrets.js'

const SYSTEM_PROMPT = `You are a strategic player in Cake Duel, a card bluffing game. Given the current game state, choose the optimal move.

DECK (20 cards total):
- Soldier ×5 (weapon): steals 1 cake per unblocked card
- Archer ×4 (weapon): steals 1 cake per unblocked card
- Wizard ×3 (magic): steals 2 cakes per unblocked card
- Defender ×4 (blocker): each card blocks 1 weapon attack (Soldier/Archer)
- Scientist ×3 (blocker): each card blocks 1 magic attack (Wizard)
- Sir Wolfy ×1: cannot be claimed or played for any effect

GAME STRUCTURE:
- Best of 3 bouts. First to win 3 bouts wins overall.
- Each bout: Attacker starts with 3 cakes, Defender starts with 4 cakes.
- Win a bout by depleting the opponent's cakes to 0.

TURN PHASES:
1. ATTACK (attacker's turn):
   - Play 1+ cards face-down and claim a card name — you can lie (bluff)!
   - Valid claim names: "Soldier", "Archer", "Wizard"
   - OR pass. Two consecutive passes end the bout (more cakes wins; tie = non-passer wins).

2. BLOCK (defender's turn):
   - Play blockers: Defender for weapon claims (Soldier/Archer), Scientist for magic claims (Wizard)
   - OR skip (let attack through — cakes stolen = attack count × card value)
   - OR challenge the attack:
     * Truthful claim → attacker wins the bout immediately
     * Bluff → defender wins the bout immediately

3. RESOLVE (attacker's turn):
   - Continue: confirm (cakes stolen = (attack count − blocks) × card value)
   - OR challenge the block (if a block was played):
     * Truthful block → defender wins the bout immediately
     * Bluff block → attacker wins the bout immediately

STRATEGY NOTES:
- Bluffing is central — claiming Wizards while playing Soldiers is very common
- Challenging is a high-risk, high-reward all-or-nothing bet on the entire bout
- Protecting cakes is critical when you have fewer than your opponent
- The player who passes last gets a strategic disadvantage on double-pass

Respond with ONLY a valid JSON object — no explanation, no markdown.`

function cardDisplayName(id: string): string {
  return id.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function describeHand(hand: string[]): string {
  const counts: Record<string, number> = {}
  for (const id of hand) counts[id] = (counts[id] ?? 0) + 1
  return Object.entries(counts)
    .map(([id, n]) => `${n}× ${cardDisplayName(id)}`)
    .join(', ')
}

export function formatGameState(state: GameState, player: Player): string {
  const isP1 = player === 'p1'
  const myHand = isP1 ? state.p1Hand : state.p2Hand
  const myCakes = isP1 ? state.p1Cakes : state.p2Cakes
  const opponentCakes = isP1 ? state.p2Cakes : state.p1Cakes
  const opponentHandCount = isP1 ? state.p2Hand.length : state.p1Hand.length
  const myName = isP1 ? state.player1Name : (state.player2Name ?? 'Opponent')
  const opponentName = isP1 ? (state.player2Name ?? 'Opponent') : state.player1Name
  const isMyTurn = state.turnPlayer === player
  const opponentPlayer: Player = player === 'p1' ? 'p2' : 'p1'

  const boutScore = state.boutWinners
    .filter((w) => w !== null)
    .map((w) => (w === player ? 'You' : 'Opponent'))

  const lines: string[] = [
    `=== GAME STATE ===`,
    `You: ${myName} | Opponent: ${opponentName}`,
    `Bout ${state.currentBout} | Bouts won so far: [${boutScore.join(', ') || 'none yet'}]`,
    `Your cakes: ${myCakes} | Opponent cakes: ${opponentCakes}`,
    `Your hand (${myHand.length} cards): ${describeHand(myHand)}`,
    `  Raw IDs for your response: ${JSON.stringify(myHand)}`,
    `Opponent hand: ${opponentHandCount} unknown cards`,
    `Deck: ${state.deck.length} cards remaining`,
  ]

  // Recent history context
  if (state.lastTurnResult) {
    const r = state.lastTurnResult
    const wasAttacker = r.attackClaim.player === player
    lines.push(``)
    lines.push(`LAST TURN RESULT:`)
    lines.push(
      `  ${wasAttacker ? 'You' : 'Opponent'} attacked claiming ${r.attackClaim.count}× ${r.attackClaim.cardName}`,
    )
    if (r.blockClaim) {
      lines.push(
        `  ${r.blockClaim.player === player ? 'You' : 'Opponent'} blocked with ${r.blockClaim.count}× ${r.blockClaim.cardName}`,
      )
    } else {
      lines.push(`  No block was played`)
    }
    lines.push(`  Cakes stolen: ${r.cakesStolen}`)
  }

  if (state.passedLast === opponentPlayer) {
    lines.push(``)
    lines.push(`NOTE: Opponent passed last turn. If you also pass → bout ends (more cakes wins).`)
  }

  lines.push(``)
  lines.push(
    `CURRENT PHASE: ${state.turnPhase?.toUpperCase()} — ${isMyTurn ? 'YOUR turn' : "Opponent's turn"}`,
  )

  if (state.attackClaim) {
    const attName = state.attackClaim.player === player ? 'You' : 'Opponent'
    lines.push(
      `Active attack: ${attName} claimed ${state.attackClaim.count}× ${state.attackClaim.cardName}`,
    )
  }
  if (state.blockClaim) {
    const blkName = state.blockClaim.player === player ? 'You' : 'Opponent'
    lines.push(
      `Active block: ${blkName} blocked with ${state.blockClaim.count}× ${state.blockClaim.cardName}`,
    )
  }

  lines.push(``)
  lines.push(`=== YOUR MOVE ===`)

  if (state.turnPhase === 'attack' && isMyTurn) {
    lines.push(`Options:`)
    lines.push(
      `  Attack: {"type":"attack","cardIds":[...IDs from your hand...],"claimedName":"Soldier"|"Archer"|"Wizard"}`,
    )
    lines.push(
      `    Example: {"type":"attack","cardIds":["soldier","wizard"],"claimedName":"Wizard"}`,
    )
    lines.push(`  Pass:   {"type":"pass"}`)
  } else if (state.turnPhase === 'block' && isMyTurn && state.attackClaim) {
    const claimedType = state.attackClaim.cardName.toLowerCase() === 'wizard' ? 'magic' : 'weapon'
    const blockerNeeded = claimedType === 'magic' ? 'scientist' : 'defender'
    const available = myHand.filter((id) => id === blockerNeeded)
    lines.push(
      `Opponent claimed ${state.attackClaim.count}× ${state.attackClaim.cardName} (${claimedType}).`,
    )
    lines.push(`You have ${available.length}× ${blockerNeeded} available.`)
    lines.push(`Options:`)
    lines.push(`  Block:     {"type":"block","cardIds":[...${blockerNeeded} IDs...]}`)
    lines.push(`    Example: {"type":"block","cardIds":["${blockerNeeded}"]}`)
    lines.push(`  Skip:      {"type":"skipBlock"}`)
    lines.push(`  Challenge: {"type":"challenge","target":"attack"}  ← risky all-or-nothing!`)
  } else if (state.turnPhase === 'resolve' && isMyTurn) {
    const hasBlock = state.blockClaim !== null
    lines.push(`Options:`)
    lines.push(`  Continue: {"type":"resolve"}`)
    if (hasBlock) {
      lines.push(
        `  Challenge block: {"type":"challenge","target":"block"}  ← risky all-or-nothing!`,
      )
    }
  }

  return lines.join('\n')
}

export async function getAIMove(
  state: GameState,
  player: Player,
): Promise<Record<string, unknown>> {
  const apiKey = OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured')

  const userMessage = formatGameState(state, player)

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek/deepseek-v4-flash',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 8000,
    }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`OpenRouter error ${resp.status}: ${text}`)
  }

  const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty response from LLM')

  try {
    return JSON.parse(content) as Record<string, unknown>
  } catch {
    throw new Error(`LLM returned invalid JSON: ${content}`)
  }
}
