import type { WebSocket } from "@fastify/websocket";
import type { ServerToClientEvent } from "@familyspeak/shared";

const connectionsByUserId = new Map<string, Set<WebSocket>>();

export function addConnection(userId: string, socket: WebSocket): void {
  let sockets = connectionsByUserId.get(userId);
  if (!sockets) {
    sockets = new Set();
    connectionsByUserId.set(userId, sockets);
  }
  sockets.add(socket);
}

export function removeConnection(userId: string, socket: WebSocket): void {
  const sockets = connectionsByUserId.get(userId);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) {
    connectionsByUserId.delete(userId);
  }
}

export function isUserOnline(userId: string): boolean {
  return (connectionsByUserId.get(userId)?.size ?? 0) > 0;
}

export function sendToUser(userId: string, event: ServerToClientEvent): void {
  const sockets = connectionsByUserId.get(userId);
  if (!sockets) return;
  const payload = JSON.stringify(event);
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) {
      socket.send(payload);
    }
  }
}

export function broadcastToUsers(userIds: Iterable<string>, event: ServerToClientEvent): void {
  for (const userId of userIds) {
    sendToUser(userId, event);
  }
}
