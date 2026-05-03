import { Hono } from "hono";
import { db } from "../db";
import { games } from "../db/schema";
import { eq } from "drizzle-orm";
import { newBout } from "../game/engine";
import type { GameState, Player } from "../game/types";
import { stateForPlayer } from "../game/engine";

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function parseGameRow(row: any): GameState {
  return {
    id: row.id,
    status: row.status,
    player1Id: row.player1Id,
    player2Id: row.player2Id,
    currentBout: row.currentBout,
    boutWinners: [row.bout1Winner, row.bout2Winner, row.bout3Winner],
    winner: row.winner,
    turnPlayer: row.turnPlayer,
    turnPhase: row.turnPhase,
    p1Hand: JSON.parse(row.p1Hand),
    p2Hand: JSON.parse(row.p2Hand),
    p1Cakes: row.p1Cakes,
    p2Cakes: row.p2Cakes,
    p1HandSize: row.p1HandSize,
    p2HandSize: row.p2HandSize,
    deck: JSON.parse(row.deck),
    discard: JSON.parse(row.discard),
    attackClaim: row.attackClaim ? JSON.parse(row.attackClaim) : null,
    blockClaim: row.blockClaim ? JSON.parse(row.blockClaim) : null,
    passedLast: row.passedLast,
  };
}

function serializeGameState(state: GameState): Record<string, any> {
  return {
    status: state.status,
    player1Id: state.player1Id,
    player2Id: state.player2Id,
    currentBout: state.currentBout,
    bout1Winner: state.boutWinners[0],
    bout2Winner: state.boutWinners[1],
    bout3Winner: state.boutWinners[2],
    winner: state.winner,
    turnPlayer: state.turnPlayer,
    turnPhase: state.turnPhase,
    p1Hand: JSON.stringify(state.p1Hand),
    p2Hand: JSON.stringify(state.p2Hand),
    p1Cakes: state.p1Cakes,
    p2Cakes: state.p2Cakes,
    p1HandSize: state.p1HandSize,
    p2HandSize: state.p2HandSize,
    deck: JSON.stringify(state.deck),
    discard: JSON.stringify(state.discard),
    attackClaim: state.attackClaim ? JSON.stringify(state.attackClaim) : null,
    blockClaim: state.blockClaim ? JSON.stringify(state.blockClaim) : null,
    passedLast: state.passedLast,
  };
}

const app = new Hono();

app.post("/api/games", async (c) => {
  const playerId = generateId();
  const gameId = generateId();

  const gameState: GameState = {
    id: gameId,
    status: "waiting",
    player1Id: playerId,
    player2Id: null,
    currentBout: 1,
    boutWinners: [null, null, null],
    winner: null,
    turnPlayer: null,
    turnPhase: null,
    p1Hand: [],
    p2Hand: [],
    p1Cakes: 3,
    p2Cakes: 4,
    p1HandSize: 4,
    p2HandSize: 4,
    deck: [],
    discard: [],
    attackClaim: null,
    blockClaim: null,
    passedLast: null,
  };

  await db.insert(games).values({
    id: gameId,
    createdAt: new Date().toISOString(),
    ...serializeGameState(gameState),
  });

  return c.json({ gameId, playerId });
});

app.post("/api/games/:id/join", async (c) => {
  const gameId = c.req.param("id");

  const rows = await db.select().from(games).where(eq(games.id, gameId));
  if (rows.length === 0) return c.json({ error: "Game not found" }, 404);

  const row = rows[0]!;
  if (row.status !== "waiting") return c.json({ error: "Game not joinable" }, 400);

  const playerId = generateId();
  const gameState = parseGameRow(row);

  const startedState = newBout(gameState, "p1");
  startedState.player2Id = playerId;

  await db
    .update(games)
    .set(serializeGameState(startedState))
    .where(eq(games.id, gameId));

  return c.json({ gameId, playerId });
});

app.get("/api/games/:id", async (c) => {
  const gameId = c.req.param("id");
  const playerId = c.req.query("player");

  const rows = await db.select().from(games).where(eq(games.id, gameId));
  if (rows.length === 0) return c.json({ error: "Game not found" }, 404);

  const row = rows[0]!;
  const gameState = parseGameRow(row);

  if (!playerId) return c.json({ error: "player query param required" }, 400);

  const player: Player = row.player1Id === playerId ? "p1" : "p2";
  if (row.player1Id !== playerId && row.player2Id !== playerId) {
    return c.json({ error: "Not in this game" }, 403);
  }

  const visibleState = stateForPlayer(gameState, player);
  return c.json(visibleState);
});

export default app;
