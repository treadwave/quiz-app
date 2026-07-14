import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@quiz/shared";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createSocket(): AppSocket {
  const url = process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4000";
  return io(url, { withCredentials: true });
}
