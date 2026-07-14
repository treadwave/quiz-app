import type { AuthTokenPayload, ClientToServerEvents, ServerToClientEvents } from "@quiz/shared";

export type { ClientToServerEvents, ServerToClientEvents };

export type InterServerEvents = Record<string, never>;

export interface SocketData {
  user: AuthTokenPayload;
  roomCode?: string;
}
