import "dotenv/config";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { registerSocketHandlers } from "./socketHandlers";
import type { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from "./types";

const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

const app = express();
app.use(cors({ origin: webOrigin, credentials: true }));
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
  httpServer,
  {
    cors: { origin: webOrigin, credentials: true },
  }
);

registerSocketHandlers(io);

const port = Number(process.env.REALTIME_PORT ?? 4000);
httpServer.listen(port, () => {
  console.log(`Realtime server listening on :${port}`);
});
