#!/usr/bin/env bun
/**
 * Apply pending migrations from ./drizzle using bun:sqlite.
 * Used by the deploy playbook: drizzle-kit needs better-sqlite3, which
 * doesn't load under Bun. Same __drizzle_migrations table as drizzle-kit.
 *
 * Usage (from the project root):
 *   bun scripts/migrate.ts
 *   DB_FILE=/path/to/other.db bun scripts/migrate.ts
 */

import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'

const sqlite = new Database(process.env.DB_FILE ?? 'cake-duel.db')
sqlite.exec('PRAGMA journal_mode=WAL')

const applied = () => {
  try {
    return (sqlite.query('SELECT count(*) AS n FROM __drizzle_migrations').get() as { n: number }).n
  } catch {
    return 0 // table not created yet
  }
}

const before = applied()
migrate(drizzle(sqlite), { migrationsFolder: './drizzle' })
console.log(`migrations applied: ${applied() - before} new (${applied()} total)`)
