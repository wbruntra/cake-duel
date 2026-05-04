# CPU AI: MCTS + Persistent Knowledge

## Overview

The CPU opponent uses **Monte Carlo Tree Search (MCTS)** with determinization to handle hidden information, backed by a **persistent knowledge base** that accumulates strategy data across self-play sessions.

Two core files:

- `src/ai/cpu-player.ts` — entry point called by the game engine each turn
- `src/ai/mcts/` — the search engine, simulation, and training modules

---

## Architecture

```
cpu-player.ts
  └─ mcts/search.ts          ← UCT tree search (the "think" step)
       ├─ simulator.ts       ← enumerates legal moves, applies them, detects bout end
       ├─ determinizer.ts    ← samples opponent's hidden hand each iteration
       ├─ node.ts            ← search tree node with UCB1 scoring
       ├─ rollout.ts         ← plays random/heuristic/knowledge-guided games to bout end
       └─ knowledge.ts       ← persistent situation→action win-rate database
```

## Decision Flow (per CPU turn)

1. **Read state** — the full `GameState` from the DB (including opponent's actual hand, which the CPU must not "cheat" with).

2. **Enumerate legal actions** — `getLegalActions()` in `simulator.ts:55` generates every valid move for the current phase:
   - Attack phase: all subsets of claimable hand cards × all claimable card names (Soldier, Archer, Wizard) + pass
   - Block phase: all subsets of hand as blocker cards + skip + challenge-attack
   - Resolve phase: resolve + challenge-block (if a block was played)

3. **MCTS search** — run N iterations (N = difficulty level: 100/1000/5000):
   - **Determinize**: replace the opponent's hand with a random sample from the unknown card pool (so the CPU reasons about what the opponent _might_ have, not what they actually have)
   - **Tree traversal**: walk the existing tree using UCB1 (balance exploration vs exploitation)
   - **Expand**: add one untried action to the tree
   - **Rollout**: simulate random moves from that point until the bout ends
   - **Backpropagate**: update win/loss counts up the tree toward the root

4. **Pick best action** — the root child with the most visits (most-explored promising action).

5. **Map to game move** — convert the internal `Action` type to the `Move` type the game engine expects.

## Why Bout-Level Evaluation

A Cake Duel _match_ is best-of-3 bouts (first to 3 bout wins). A _bout_ is a single contest: attacker starts with 3 cakes, defender with 4, and all cards are drawn fresh from a shuffled deck.

**Nothing carries over between bouts.** Cards, cakes, and hands all reset. This means:

- A bout is an independent game with no carryover state
- Evaluating to bout end (~2-8 moves) gives much stronger signal than evaluating to match end (~6-30 moves of random noise)
- The MCTS tree only needs to search within the current bout

All rollouts and tree search stop at bout boundaries, not match boundaries. The bout winner becomes the evaluation signal.

## Hidden Information: Determinization

The CPU _should not_ know the opponent's cards or the true identity of face-down cards. But the `GameState` in the DB contains everything. So at the start of each MCTS iteration, `determinizer.ts` creates a **determinization**:

1. Pool all cards whose location is unknown to the CPU (`opponent's hand + deck`)
2. Shuffle the pool
3. Assign the first N cards to the opponent's hand (preserving the correct hand size)
4. The rest becomes the deck

Each MCTS iteration gets a different determinization. Over thousands of iterations, the CPU reasons about _distributions_ of possible opponent holdings — it doesn't "know" what the opponent has, but it knows what's likely.

**Known limitation**: Opponent claim cards (`playedCardIds`) are not yet resampled. In V1, the CPU can theoretically "see" what cards an opponent actually played face-down (since card IDs are in the game state). This is tracked as an area for improvement.

## Knowledge Base (Persistent Memory)

The CPU has a persistent memory file: `cpu-knowledge.json`. This stores **situation → action → win rate** statistics accumulated from self-play.

### Situation Encoding

A "situation" is everything the CPU can observe at a decision point, hashed into a string key.

**Factors included** (see `encodeSituation` in `knowledge.ts:33`):
| Factor | Example | Rationale |
|--------|---------|-----------|
| Phase | `attack`, `block`, `resolve` | Different decision types |
| My cakes | `3` | Risk tolerance — being down changes strategy |
| Opponent cakes | `4` | How aggressive to be |
| Hand composition | `w:2,wb:1,db:0,sb:1` | What tools are available |
| Attack: opponent passed? | `oppPassed` / `noPass` | Double-pass ends the bout — more cakes wins; tie goes to non-passer |
| Block: attack claim | `at:w2` | "2 weapons claimed" — threat level |
| Block: correct blockers | `hb:1` | Whether blocking is even possible |
| Resolve: block exists? | `hasblock` / `noblock` | Whether challenging block is an option |

**Granularity tradeoff**: Too fine → sparse data, never enough training. Too coarse → lumps different situations together, loses specificity. Current encoding produces ~350 unique situations from 200 bouts of self-play. This is a good starting point — common situations accumulate data quickly, while rare situations fall back to random exploration.

### Learning from Self-Play

When self-play runs (via `self-play.ts`), every action taken by the CPU during a bout is recorded alongside the bout outcome. If the CPU won the bout, every action in the path gets a "win" credit; if it lost, every action gets a "loss".

This is stored as:

```json
{
  "attack|3|4|w:1,wb:2,db:0,sb:1|noPass": {
    "attack|Wizard|2": { "wins": 5, "visits": 8 },
    "attack|Soldier|1": { "wins": 2, "visits": 7 },
    "pass": { "wins": 1, "visits": 3 }
  }
}
```

### Using Knowledge During Rollouts

The `knowledge` rollout policy (`knowledgeGuidedPick`) uses **epsilon-greedy selection**:

- 80% of the time: pick the action with the best historical win rate (if ≥5 visits of data exist)
- 20% of the time: pick a random action (exploration)

This means rollouts are smarter than random — they bias toward historically successful moves — but still explore enough to discover new strategies and adapt to novel situations.

### How the CPU Gets Smarter

```
Step 1: Run `bun run ai:train` → 1000 bouts of self-play
         → cpu-knowledge.json populated with ~1000 situations

Step 2: Play vs CPU in the game → CPU uses knowledge-guided rollouts
         → rollouts are smarter because they bias toward proven strategies

Step 3: Run `bun run ai:train` again → another 1000 bouts
         → more situations covered, better statistics per situation
         → CPU plays stronger

Repeat. Knowledge accumulates across sessions.
```

## Difficulty Levels

| Level  | MCTS Iterations | Effect                        |
| ------ | --------------- | ----------------------------- |
| Easy   | 100             | ~2ms per move, shallow search |
| Medium | 1,000           | ~20ms per move, decent search |
| Hard   | 5,000           | ~100ms per move, deep search  |

More iterations = more rollouts per decision = better move quality. The knowledge base benefits all difficulty levels equally by making each rollout smarter.

## Self-Play & Training

Two scripts:

### `bun run ai:self-play <p1-level> <p2-level> <bouts>`

Runs headless bout-level self-play between two MCTS players. Records every decision → outcome pair to the knowledge base.

```
bun run ai:self-play medium medium 5000
```

### `bun run ai:evaluate <bouts>`

Runs a tournament between different configs (random vs easy vs medium) and prints win rates.

```
bun run ai:evaluate 100
```

### `bun run ai:train`

Shortcut for `ai:self-play medium medium 1000`. Good for quick training sessions.

## Key Constraints for Developers

1. **Bout independence**: Cards, cakes, and hands fully reset between bouts. Always evaluate at bout level, never match level.

2. **Hidden information**: The GameState contains everything, but the CPU must reason from partial information. The determinizer is the enforcement point — all hidden-info improvements should go there.

3. **Action space growth**: With 4 cards, attack actions are ~46 (15 subsets × 3 claim names + pass). Block actions are ~17 (15 block subsets + skip + challenge). This is tractable for MCTS without pruning.

4. **Knowledge file format**: `cpu-knowledge.json` is a simple JSON object. Entries with <5 visits are treated as unreliable and ignored during knowledge-guided selection. The file can be inspected, edited, or shared between environments.

5. **Perspective encoding**: The situation hash is from _one player's_ perspective. Training data from both players is mingled — P1's and P2's situations are both recorded. This means the knowledge base naturally learns both attacking and defending strategies.

## Future Directions

- **Resample opponent claim cards** in the determinizer (currently the CPU can "see" opponent face-down cards)
- **Heuristic rollout tuning** — use self-play stats to optimize bluff probability, challenge thresholds
- **Neural network rollout** — replace heuristic/random rollouts with a small neural net trained on self-play data (AlphaZero-style value network)
- **Opponent modeling** — track per-opponent bluff rates across turns
