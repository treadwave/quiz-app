import type { Socket } from "socket.io";
import { AUTH_COOKIE_NAME, verifyAuthToken, type AuthTokenPayload } from "@quiz/shared";

function parseCookies(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  }
  return result;
}

export function authenticateSocket(socket: Socket): AuthTokenPayload | null {
  const cookies = parseCookies(socket.handshake.headers.cookie);
  const token = cookies[AUTH_COOKIE_NAME];
  if (!token) return null;
  try {
    return verifyAuthToken(token);
  } catch {
    return null;
  }
}
