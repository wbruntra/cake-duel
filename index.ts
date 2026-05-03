import { Hono } from "hono";
import { cors } from "hono/cors";
import gameRoutes from "./src/routes/games";
import { handleWebSocket } from "./src/routes/ws";

const app = new Hono();

app.use("/*", cors());

app.route("/", gameRoutes);

const server = Bun.serve({
  port: 9001,
  fetch: app.fetch,
  websocket: {
    open: (ws) => {
      handleWebSocket(ws);
    },
  },
});

console.log(`Server running on http://localhost:${server.port}`);
