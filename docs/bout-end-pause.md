# Bout-End Pause — Design Sketch

## Problem

Today, when a bout ends, the server immediately rolls into the next bout and broadcasts the post-`newBout` state. The client receives a single `state` message and the UI jumps from `resolve` (or the doublepass moment) straight into the next bout's `attack` phase. There is no visible "you won this bout" / "you lost this bout" beat — which is the whole emotional point of the game.

Goal: make bout-end a first-class, observable moment that both players have to acknowledge before play continues.

## Current flow (anchors)

- `endBout()` — `src/game/engine.ts:252-288` — records the winner, then either marks the duel `finished` or **immediately** calls `newBout()` and returns the next bout's state in the same object.
- WS handler — `src/routes/ws.ts:178-210` — both call sites (`resolve` case at line 184, `pass`+doublePass case at line 202) call `endBout()` and broadcast its result in one shot.
- Frontend — `PlayArea.jsx:18` only branches on `game_over`. `ActionBar.jsx:154-178` has phase branches for `resolve`, `resupply`, `game_over` but nothing for `bout_end`. `useWebSocket.js:28` just `setState(msg.state)` — no awareness of phase deltas.
- Already in place (don't need to add): `TurnPhase` union includes `'bout_end'` (`src/game/types.ts:2`); DB enum includes it (`src/db/schema.ts:16`). The slot is reserved, just unused.

## Proposed flow

1. Bout-victory condition triggers (cakes hit 0, or doublepass) — server runs the bout-end resolution (records winner, updates `boutWinners`) but **stops there**. Sets `turnPhase: 'bout_end'`. No deck reshuffle, no new hands. Cake counts at moment of victory are preserved so the UI can show "they hit 0 cakes".
2. Server broadcasts that state. Both clients render a bout-result screen: "You won bout 2" / "You lost bout 2", current series score (e.g. 1–1 → 2–1), and a **Continue** button.
3. Each client sends a `boutAck` message when its player taps Continue. Server tracks acks. When both have acked (or a server-side timeout fires — see below), server runs `newBout()` and broadcasts the fresh `attack`-phase state.
4. If the bout-victory was the **3rd** bout win, skip the ack dance: go straight to `status: 'finished'` / `turnPhase: 'game_over'` as today. The existing game-over screen is the pause.

The ack-with-fallback pattern (rather than a fixed timer) means: each player gets to dwell on the result for as long as they want, but a disconnected/AFK opponent can't stall the duel forever.

## Backend changes

### Schema — `src/db/schema.ts`

Add one column to `games`:

```ts
boutEndAcks: text('bout_end_acks').notNull().default('[]'),  // JSON array of 'p1' | 'p2'
```

Migration via drizzle-kit. `bout_end` is already in the `turnPhase` enum, no change there.

### Engine — `src/game/engine.ts`

Split `endBout()` into two functions:

```ts
// New: records winner + sets bout_end phase, but does NOT start the next bout.
// Returns terminal state if this was the deciding bout.
export function finishBout(state: GameState, boutWinner: Player): GameState {
  const boutIndex = state.currentBout - 1
  const newWinners = [...state.boutWinners]
  newWinners[boutIndex] = boutWinner

  const p1Wins = newWinners.filter((w) => w === 'p1').length
  const p2Wins = newWinners.filter((w) => w === 'p2').length

  if (p1Wins >= 3 || p2Wins >= 3) {
    return {
      ...state,
      boutWinners: newWinners,
      winner: p1Wins >= 3 ? 'p1' : 'p2',
      status: 'finished',
      turnPhase: 'game_over',
    }
  }

  return {
    ...state,
    boutWinners: newWinners,
    turnPhase: 'bout_end',
    boutEndAcks: [],
    // attackClaim/blockClaim/cakes preserved so UI can show how the bout ended
  }
}

// New: called once both players have acked. Starts the next bout.
export function startNextBout(state: GameState): GameState {
  const lastWinner = state.boutWinners[state.currentBout - 1] as Player
  const loser = opponent(lastWinner)
  return newBout(
    {
      ...state,
      currentBout: state.currentBout + 1,
      boutEndAcks: [],
    },
    loser,
  )
}

// New: idempotent ack. Returns updated state and whether both have acked.
export function ackBoutEnd(
  state: GameState,
  player: Player,
): { state: GameState; bothAcked: boolean; error?: string } {
  if (state.turnPhase !== 'bout_end') {
    return { state, bothAcked: false, error: 'Not in bout_end phase' }
  }
  const acks = state.boutEndAcks.includes(player)
    ? state.boutEndAcks
    : [...state.boutEndAcks, player]
  return {
    state: { ...state, boutEndAcks: acks },
    bothAcked: acks.length === 2,
  }
}
```

Delete the old `endBout()` (or keep as a thin wrapper that calls `finishBout` + `startNextBout` for tests that exercise the full transition).

`GameState` gains `boutEndAcks: Player[]` (`src/game/types.ts`). `stateForPlayer` exposes it so the client knows whether _it_ has acked and whether the opponent has.

### WS handler — `src/routes/ws.ts`

Replace the two `endBout(...)` callsites with `finishBout(...)`:

```ts
// resolve case (line 184)
if (boutOver) {
  const boutWinner: Player = attackerWins
    ? state.attackClaim!.player
    : opponent(state.attackClaim!.player)
  const afterFinish = finishBout(resolved, boutWinner)
  await saveGame(afterFinish)
  broadcast(afterFinish)
}

// pass+doublePass case (line 200)
if (result.doublePass) {
  const boutWinner = determineBoutWinnerOnPass(result.state)
  const afterFinish = finishBout(result.state, boutWinner)
  await saveGame(afterFinish)
  broadcast(afterFinish)
}
```

Add a new message handler:

```ts
case 'boutAck': {
  const ackResult = ackBoutEnd(state, player)
  if (ackResult.error) {
    send(ws, { type: 'error', message: ackResult.error })
    return
  }
  if (ackResult.bothAcked) {
    const next = startNextBout(ackResult.state)
    await saveGame(next)
    broadcast(next)
  } else {
    await saveGame(ackResult.state)
    broadcast(ackResult.state)  // so the other client sees "opponent ready"
  }
  break
}
```

### Auto-advance fallback (server-side timer)

To handle disconnect/AFK, when `finishBout` produces a `bout_end` state, schedule a server-side timeout (e.g. 30s) per game. If both haven't acked by then, force `startNextBout`. Implementation: a `Map<gameId, Timer>` alongside `connections`. Cleared on `boutAck` resolution and on game completion.

Keep this generous (30s, not 3s) — the point is to survive a dropped connection, not to rush players. Players who _want_ to move fast just both tap Continue.

## Frontend changes

### State plumbing

`stateForPlayer` already projects everything we need; just add:

```ts
boutEndAcks: state.boutEndAcks,  // so client sees ['p1'] when only p1 has acked
```

### New component — `frontend/src/components/game/BoutEndScreen.jsx`

Renders when `state.turnPhase === 'bout_end'`. Shows:

- Outcome line: "You won bout N" / "Opponent won bout N", with appropriate color (use existing `accent` / `danger` tokens).
- Series score: render `boutWinners` as 3 pips, filled per winner, current bout highlighted.
- A short "why" line — derive from `attackClaim` / `blockClaim` / cakes:
  - if `defenderCakes <= 0` → "Cakes ran out"
  - else (doublepass) → "Both passed — most cakes wins"
- Continue button (full-width, same style as `ActionBar`'s `Continue` in resolve).
- After this player acks, swap the button for "Waiting for opponent…" and surface that the opponent has/hasn't acked yet.

`PlayArea.jsx`: add a `state.turnPhase === 'bout_end'` branch that returns `<BoutEndScreen />` instead of the normal play area. Or render it as a full-screen overlay (cleaner — preserves spatial continuity when the next bout begins).

`ActionBar.jsx`: add a `bout_end` branch that hides the normal action UI (the Continue button lives inside `BoutEndScreen`, not the action bar — bout end isn't a "do an action" moment, it's a result moment).

### Sending the ack

```js
function doBoutAck() {
  tap()
  send({ type: 'boutAck' })
}
```

Disable the button after click; show "Waiting for opponent…" based on `boutEndAcks.includes(state.player)`.

## Edge cases

- **Idempotent ack**: `ackBoutEnd` already dedupes. Double-clicks safe.
- **Reconnect during `bout_end`**: client joins, receives the `bout_end` state with current `boutEndAcks`, renders the screen accordingly. If they'd already acked before disconnecting, button shows "Waiting for opponent…" — works because the ack is in DB state, not connection state.
- **Both players disconnect**: timer still fires server-side, advances the bout. When they reconnect they'll be in the next bout. Acceptable — the alternative (freezing the duel forever) is worse.
- **3rd bout win**: `finishBout` sets `status: 'finished'` directly; clients render the existing `game_over` UI. No ack flow. The duel-end screen _is_ the pause.
- **What about bout 1's beginning?** Not in scope. The first attack screen is itself the "we're starting" moment. Only inter-bout transitions need the pause.

## Open questions

1. **Should the loser get a different message than the winner?** Sketched as symmetric ("You won/lost bout N"). Could be more elaborate ("Opponent depleted your cakes" vs. "You depleted opponent's cakes") — costs little; defer to UX taste.
2. **Auto-advance timeout duration**: 30s is a guess. Easy to tune.
3. **Should we show the final cake counts on the bout-end screen?** Probably yes for the doublepass case (since "most cakes wins" is the rule), maybe redundant for the cakes-to-zero case. Cheap to include both.
4. **Animation**: a brief slide/fade as the bout-end screen enters (using the existing `motion` lib) would help sell the moment. Not strictly required for v1.

## Test plan

- Engine unit tests: `finishBout` does _not_ mutate hands/deck; `startNextBout` reshuffles and resets cakes; `ackBoutEnd` is idempotent and only flips `bothAcked` when both players have acked; deciding-bout case bypasses `bout_end`.
- WS integration: simulate two clients, drive a bout to victory both ways (cake-depletion + doublepass), confirm both receive `bout_end` state, neither sees `newBout` until both ack, single-ack state shows correct partial `boutEndAcks`.
- Reconnect test: ack as p1, disconnect p1, reconnect — state shows p1 already acked. p2 acks, both advance.
- Timeout test: only p1 acks; after timer, server advances anyway and broadcasts `attack` phase.

## Rough size

Backend: ~80 LOC across engine, ws, schema, migration. Frontend: ~120 LOC for `BoutEndScreen` + the two phase-branch additions. Tests: ~150 LOC. One DB migration. No breaking changes to existing message types.
