# Napkin

## Corrections

| Date       | Source | What Went Wrong                                                                      | What To Do Instead                                                                                  |
| ---------- | ------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| 2026-05-04 | self   | `makeHand` creates IDs like `soldier_0` which don't match card DB IDs like `soldier` | When testing `isClaimTruthful`/`getCardById`, use actual card IDs (`soldier`) not suffixed test IDs |

## Patterns That Work

- Game phases that require acknowledgment: `challenge_result` and `bout_end` both use ack arrays (`challengeAcks`, `boutEndAcks`) with auto-timer fallbacks
- `TurnResult` data is stored on state (`lastTurnResult`) for frontend overlay display, cleared on next turn
- Frontend overlays: `ChallengeResultScreen` is a full-screen modal (like `BoutEndScreen`), `TurnResultOverlay` is a non-blocking animated overlay
- DB migrations use `bunx drizzle-kit generate` then `bunx drizzle-kit migrate`

## Domain Notes

- Cake Duel is a card game with bluffing challenges. Key phases: attack → block → resolve → resupply (internal) → next attack
- Challenges end the bout immediately — now paused with `challenge_result` phase for both players to see
- `resupply` is not a game phase (removed from TurnPhase) — it's an internal engine function
