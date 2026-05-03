# Cake Duel — Mobile-First Frontend Redesign

## Context

The existing frontend is functionally complete but desktop-first: `#root` is hardcoded to `width: 1126px`, there is one media query (only adjusting font sizes at 1024px), `Card` has `min-width: 80px`, the lobby has 80px top padding, the claim picker is a `<select>`, and there's no PWA setup, safe-area handling, or touch feedback. The intended use case is two players each on their own phone in portrait, so the UI needs to be reachable with one thumb, fit a single screen on 360–430px wide devices, and feel like a native app when added to the home screen.

The backend, WebSocket protocol, and game flow are stable and don't need changes. Only the frontend at `frontend/` is in scope.

## Stack additions

Install in `frontend/`:

```
bun add -d tailwindcss @tailwindcss/vite
bun add motion
```

- **Tailwind CSS v4** via `@tailwindcss/vite` plugin — no `tailwind.config.js`, no PostCSS. Theme tokens declared in CSS via `@theme { … }`.
- **motion** (the `motion/react` package, formerly framer-motion) — for card-flip on resolve, sheet slide, phase pill cross-fade, cake transfer.

No component kit. The bottom sheet, toast, and selection badge are ~30 lines of JSX each — a kit would ship 100kb+ for things we'd never use.

## Layout architecture (portrait, 100dvh)

```
┌──────────────────────────┐  pt-[env(safe-area-inset-top)]
│ HEADER  (44px)           │  Bout · You 1–0 Opp · ●●○ · ⋯ menu
├──────────────────────────┤
│ OPPONENT (≈22%)          │  fanned facedown card-back row + cake pill
├──────────────────────────┤
│ BATTLEFIELD (1fr)        │  phase pill + facedown attack/block claims
├──────────────────────────┤
│ PLAYER STATS (≈14%)      │  cake pill + selection running total
├──────────────────────────┤
│ ACTION BAR (sticky 64px) │  one full-width CTA, phase-aware label/color
├──────────────────────────┤
│ HAND (≈22%)              │  horizontal snap-scroll, lifted-on-select
└──────────────────────────┘  pb-[env(safe-area-inset-bottom)]
```

Use CSS Grid (`grid-template-rows: auto auto 1fr auto auto auto`) with `min-h-dvh` (not `vh` — iOS Safari URL bar would break it). Bottom 40% is the thumb zone and contains all interactive UI.

## File-by-file changes

### Configuration

- **`frontend/vite.config.js`** — register `@tailwindcss/vite` plugin alongside React.
- **`frontend/index.html`** — replace viewport with `width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no`. Add `theme-color` (light + dark via `media`), `apple-mobile-web-app-capable=yes`, `apple-mobile-web-app-status-bar-style=black-translucent`, `apple-mobile-web-app-title=Cake Duel`, `apple-touch-icon`, `manifest` link. Update `<title>` to "Cake Duel".

### Styles

- **`frontend/src/index.css`** — replace contents with `@import "tailwindcss";` plus a `@theme` block carrying the existing tokens (`--color-accent`, `--color-bg`, etc.) and a `@media (prefers-color-scheme: dark)` override block. **Delete the `#root { width: 1126px }` rule** — single biggest desktop-first offender. Add `body, #root { min-height: 100dvh; margin: 0; }` and `.safe-bottom { padding-bottom: max(env(safe-area-inset-bottom), 12px); }`, `.safe-top { padding-top: max(env(safe-area-inset-top), 8px); }`.
- **`frontend/src/App.css`** — delete after per-component migration.

### Components

- **`frontend/src/App.jsx`** — wrap content in `<div className="min-h-dvh grid grid-rows-[auto_1fr]">`. Move "Leave Game" out of absolute positioning into a 44px overflow menu button in the header (top-right). Pass `onLeave` down through `GameContext` so the header can render it.
- **`frontend/src/components/lobby/Lobby.jsx`** — vertical stack centered with `max-w-sm mx-auto px-6`. Inputs use `w-full h-14 text-lg`, CTAs `h-14 w-full text-lg font-semibold`. Remove `width: 200px` input and `width: 300px` divider. Auto-focus join input only when `initialJoinId` is present.
- **`frontend/src/components/game/GameView.jsx`** — apply the grid scaffold from the layout section. Render new `<ActionBar />` as a sibling, sticky-bottom.
- **`frontend/src/components/game/GameHeader.jsx`** — collapse to one 44px row: `Bout {n} · You {a}–{b} Opp · ●●○`. Bout markers become 8px dots, not chips. Add "Leave" button (3-dot icon) at right end.
- **`frontend/src/components/game/OpponentArea.jsx`** — render `opponentHandCount` as a fan of facedown card backs (overlapping ~70% with negative margin). Compact cake count pill (`🍰 × N`). When opponent has played a claim, show their facedown stack centered.
- **`frontend/src/components/game/PlayArea.jsx`** — becomes purely the battlefield: phase pill (color cross-fade via `motion`) at top, attack claim and block claim cards centered. **Move the Resolve Turn button out** into `ActionBar`. On entering `resolve` phase, animate cards flipping face-up (motion's rotateY).
- **`frontend/src/components/game/PlayerArea.jsx`** — strip down to: cake pill + small "Selected: 2 cards · 🍰2 total" line. **All action UI moves to `ActionBar`.** Lift `selectedIndices` and `claimedName` state into `GameContext` (or a new `useGameUI` hook in `frontend/src/hooks/`) so `ActionBar` can read/dispatch them.
- **`frontend/src/components/game/Card.jsx`** — remove `min-width: 80px`. Add `size` prop (`sm | md | lg`) → Tailwind classes (`w-14 h-20 / w-20 h-28 / w-28 h-40`, all `aspect-[5/7]`). Add `min-h-[44px] active:scale-95 transition-transform touch-manipulation select-none`. Add a numbered selection badge (small pill in top-right corner with the play-order index) when selected — drives multi-card play UX.
- **`frontend/src/components/game/Hand.jsx`** — switch to `flex overflow-x-auto snap-x snap-mandatory gap-2 px-4 -mx-4 pb-2`. Each card is a `snap-center` child. Selected cards get `-translate-y-3`. Add subtle gradient mask edges to hint scroll.
- **`frontend/src/components/game/CakeDisplay.jsx`** — compact horizontal pill `🍰 × N` instead of label + emoji row. Animate count change with motion (`AnimatePresence` + count-up).

### New files

- **`frontend/src/components/game/ActionBar.jsx`** — sticky bottom bar. Phase-aware single primary CTA with secondary action when relevant:
  - Idle (opponent's turn): disabled `Waiting…` with phase text.
  - Attack phase, no cards selected: `Pass` (full width, neutral).
  - Attack phase, cards selected, no claim: `Choose claim →` opens `ClaimPicker`.
  - Attack phase, cards + claim: `Attack as {claim} (×{n})` (primary green) + small `Pass` link.
  - Block phase, no cards: `Let through` (full width, neutral).
  - Block phase, cards selected: `Block as {blocker} (×{n})` (primary orange) + small `Let through`.
  - Resolve phase, my turn (engine's `resolve` is server-driven for current setup but expose a `Continue` CTA when the engine surfaces it): `Continue` (primary blue).
  - Game over: `Play again` → calls `onLeave`.
  - Always `min-h-[64px]`, `safe-bottom` padding, `text-lg font-semibold`.
- **`frontend/src/components/game/ClaimPicker.jsx`** — bottom sheet. `position: fixed; inset-x-0; bottom-0` div with `motion`'s `initial={{y:'100%'}} animate={{y:0}}`. Backdrop dims background and closes on tap. Three tiles full-width, each 96px tall: Soldier (🗡 weapon · steal 🍰1), Wizard (✨ magic · steal 🍰2), and the second weapon (Archer if engine treats it as distinct claim — confirm by reading `getAttackerOptions()` in `frontend/src/utils/cards.js`). Tap selects, sheet closes, claim is set in shared state.
- **`frontend/src/components/game/PhaseToast.jsx`** — small 250ms fade-in/slide-down banner triggered by phase changes ("Opponent attacked with 2 cards", "You blocked!", "Bout won!"). Mount once at GameView level, react to state diffs in a `useEffect`.
- **`frontend/src/hooks/useGameUI.js`** — small store for ephemeral UI state that needs to span `PlayerArea`, `Hand`, and `ActionBar`: `selectedIndices`, `claimedName`, `claimPickerOpen`. Plain `useState` exposed via context, lifted out of `PlayerArea`.
- **`frontend/src/utils/haptics.js`** — `tap()` → `navigator.vibrate?.(10)`, `success()` → `[20,40,20]`. Called on card select, CTA tap, bout win.
- **`frontend/public/manifest.webmanifest`** — name, short_name, start_url `/`, display `standalone`, orientation `portrait`, background_color `#16171d`, theme_color `#aa3bff`, icons 192 + 512 (with `purpose: "any maskable"` on 512).
- **`frontend/public/icon-192.png`**, **`frontend/public/icon-512.png`**, **`frontend/public/apple-touch-icon.png`** — PNG icons (180×180 for apple-touch). Generate from a simple cake emoji on accent background or hand-craft. We'll generate placeholder icons via `Bun.write` + a small canvas script, or hand-generate with ImageMagick — to confirm at implementation.

### Engine + WebSocket — no changes

The backend, `useWebSocket.js`, and `GameContext.jsx` are unchanged. All state shape and actions stay as-is.

## Reuse / existing utilities

- `frontend/src/utils/cards.js` — `getAttackerOptions()`, `getBlockerName()`, `getCardInfo()` already provide everything `ClaimPicker` and `Card` need. Keep as-is.
- `frontend/src/hooks/useWebSocket.js` — connection logic stays. Just consume from new `ActionBar`.
- `frontend/src/context/GameContext.jsx` — extend to also expose `onLeave` (so the header menu can call it without prop-drilling) and optionally bundle `useGameUI` state.

## Phasing within the redesign

Implement in this order so the app stays runnable at every checkpoint:

1. Install Tailwind, port theme tokens to `index.css`, fix `index.html` viewport, delete `#root` fixed width. Verify nothing visually breaks beyond expected layout shift.
2. Add manifest + apple-touch-icon + theme-color meta. Verify "Add to Home Screen" works on iOS Safari.
3. Refactor `App.jsx` + `GameView.jsx` grid scaffold and `safe-bottom`/`safe-top` utilities.
4. Rebuild `Card.jsx` with size prop + tap target + active scale.
5. Convert `Hand.jsx` to snap-scroll.
6. Lift selection state to `useGameUI`, build `ActionBar.jsx`, gut `PlayerArea.jsx`.
7. Build `ClaimPicker.jsx` bottom sheet.
8. Rebuild `OpponentArea.jsx` fanned card backs and `CakeDisplay.jsx` pill.
9. Rebuild `GameHeader.jsx` compact row + leave menu.
10. Rebuild `Lobby.jsx` mobile stack.
11. Add `PhaseToast.jsx` + motion animations on phase pill, card flip on resolve, cake count.
12. Wire `haptics.js` into card taps and CTA presses.
13. Delete `App.css`.

## Verification

After implementation:

1. **Run locally:** `bun run dev` (root). Backend on 9001, frontend on 9002.
2. **Mobile viewport check:** Open Chrome DevTools → device toolbar → iPhone 13 (390×844) and Pixel 7 (412×915). Confirm no horizontal scroll, action bar visible above home indicator simulation, hand scrollable, cards tappable.
3. **Two-player flow:** Open one phone-emulated tab as P1 (create game), copy invite, open second tab as P2 (join). Play through one bout: attack with 1 card claiming Soldier → opponent sees facedown claim → blocks with Defender → resolve plays out → cake counts update with animation. Confirm phase pill cross-fades and toasts appear.
4. **PWA check:** In Chrome DevTools → Application → Manifest tab, confirm manifest loads, icons resolve, no errors. On a real iOS device, "Add to Home Screen" should produce a standalone app with the cake icon and no Safari chrome.
5. **Tap targets:** Lighthouse mobile audit (DevTools → Lighthouse → Mobile). Target ≥90 on Accessibility and PWA categories. All interactive elements should be ≥44×44.
6. **Tests:** `bun test` from project root — should still pass; only `engine.test.ts` exists and isn't affected.
7. **Manual edge cases:** rotate to landscape (should still work, just less optimized), test empty hand state, test game-over screen, test the opponent-disconnect path (page refresh on one side).

## Critical files to modify

- `frontend/vite.config.js`
- `frontend/index.html`
- `frontend/src/index.css`
- `frontend/src/App.jsx`
- `frontend/src/App.css` (delete at end)
- `frontend/src/components/game/GameView.jsx`
- `frontend/src/components/game/GameHeader.jsx`
- `frontend/src/components/game/OpponentArea.jsx`
- `frontend/src/components/game/PlayArea.jsx`
- `frontend/src/components/game/PlayerArea.jsx`
- `frontend/src/components/game/Card.jsx`
- `frontend/src/components/game/Hand.jsx`
- `frontend/src/components/game/CakeDisplay.jsx`
- `frontend/src/components/lobby/Lobby.jsx`
- `frontend/src/context/GameContext.jsx`

New: `frontend/src/components/game/ActionBar.jsx`, `ClaimPicker.jsx`, `PhaseToast.jsx`, `frontend/src/hooks/useGameUI.js`, `frontend/src/utils/haptics.js`, `frontend/public/manifest.webmanifest`, three icon PNGs.
