# Cake Duel — Dev Guide

## Running

```bash
bun install && cd frontend && bun install && cd ..
bun run dev        # backend :9001 + frontend (Vite)
bun test           # run tests
```

## Project Structure

```
index.ts                  # Bun.serve() entry — HTTP routes + WebSocket upgrade
src/
  db/schema.ts            # Drizzle table definitions (source of truth)
  db/game-store.ts        # DB read/write helpers
  game/engine.ts          # Pure game logic (no DB)
  game/cards.ts           # Card definitions
  services/game.ts        # Orchestrates engine + DB + WebSocket push
  services/connections.ts # WebSocket connection registry
  routes/games.ts         # HTTP handlers
  routes/ws.ts            # WebSocket message handlers
  ai/llm-player.ts        # LLM-controlled player
frontend/                 # React app (Vite)
drizzle/                  # Migration files (committed, never edit by hand)
```

## Database Migrations

**Never run SQL directly against the DB.** Always use migrations so `__drizzle_migrations` stays in sync.

After changing `src/db/schema.ts`:

```bash
bun run db:update   # generate migration file + apply it
```

Steps separately if needed:

```bash
bun run db:generate  # create migration file from schema diff
bun run db:migrate   # apply pending migrations
```

## Bun-specific conventions

- Use `bun:sqlite` (not `better-sqlite3`), `Bun.file` (not `fs`), `Bun.$` (not `execa`)
- Use `bunx` instead of `npx`
- `.env` is loaded automatically — no dotenv
- Backend uses `Bun.serve()` — no express, no ws package
