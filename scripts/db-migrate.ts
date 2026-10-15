#!/usr/bin/env bun
/**
 * Generate + apply migrations in one step.
 * Run this whenever you change src/db/schema.ts.
 *
 * Usage:
 *   bun run db:update
 */

import { $ } from 'bun'

// Generate new migration file if schema has changed
const generate = await $`bunx drizzle-kit generate`.text()
console.log(generate.trim())

// Apply any pending migrations
// drizzle-kit can't connect via bun:sqlite, so apply with our own migrator
const migrate = await $`bun scripts/migrate.ts`.text()
console.log(migrate.trim())
