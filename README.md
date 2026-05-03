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

SQLite via `bun:sqlite`. The database file (`cake-duel.db`) is created automatically on first run. To manage the schema with Drizzle Kit:

```bash
bunx drizzle-kit generate
bunx drizzle-kit migrate
```
