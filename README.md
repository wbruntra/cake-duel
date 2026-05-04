# Cake Duel

A web implementation of the Cake Duel card game — deploy Sheepie troops, bluff your way to victory, and steal all your opponent's cakes.

## Tech Stack

**Backend**

- [Bun](https://bun.sh) — runtime, package manager, and test runner
- [Hono](https://hono.dev) — HTTP routing
- [Drizzle ORM](https://orm.drizzle.team) + `bun:sqlite` — database access and schema management
- Native `WebSocket` via `Bun.serve()` — real-time game state

**Frontend**

- [React 19](https://react.dev) + JSX
- [Vite](https://vite.dev) — dev server and bundler
- Plain CSS

## Project Structure

```
index.ts          # Server entry point (HTTP + WebSocket)
src/
  db/             # Drizzle schema and database helpers
  game/           # Game engine, card logic, types
  routes/         # HTTP routes and WebSocket handlers
frontend/
  src/            # React app
```

## Running Locally

Install dependencies for both backend and frontend:

```bash
bun install
cd frontend && bun install && cd ..
```

Start both servers concurrently (backend on `:9001`, frontend via Vite):

```bash
bun run dev
```

Or run them separately:

```bash
bun run backend    # API + WebSocket server at http://localhost:9001
bun run frontend   # Vite dev server (proxies API to backend)
```

## Running Tests

```bash
bun test
```

## Database

SQLite via `bun:sqlite`. The database file (`cake-duel.db`) is created automatically on first run.

### Migrations

Schema is managed with Drizzle Kit. **Never alter the database directly** — always go through migrations so `__drizzle_migrations` stays in sync.

After changing `src/db/schema.ts`, run:

```bash
bun run db:update
```

This generates a new migration file under `drizzle/` and immediately applies it. Both steps are required — running only `generate` leaves the DB unchanged, and running only `migrate` without generating first applies nothing new.

If you need to run the steps separately:

```bash
bun run db:generate   # create migration file from schema diff
bun run db:migrate    # apply pending migrations to the DB
```
