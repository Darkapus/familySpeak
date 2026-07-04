import fp from "fastify-plugin";
import fastifyWebsocket from "@fastify/websocket";
import type { FastifyInstance } from "fastify";
import { addConnection, broadcastToUsers, isUserOnline, removeConnection } from "../ws/registry.js";
import { handleClientMessage, handleGameDisconnect } from "../ws/handlers.js";
import { listConversationPartnerIds } from "../modules/conversations/repository.js";

export default fp(async function websocketPlugin(app: FastifyInstance) {
  await app.register(fastifyWebsocket);

  app.get<{ Querystring: { token?: string } }>("/ws", { websocket: true }, (socket, request) => {
    const token = request.query.token;
    if (!token) {
      socket.close(4001, "unauthorized");
      return;
    }

    let userId: string;
    try {
      const payload = app.jwt.verify<{ sub: string }>(token);
      userId = payload.sub;
    } catch {
      socket.close(4001, "unauthorized");
      return;
    }

    const wasOffline = !isUserOnline(userId);
    addConnection(userId, socket);
    app.log.info({ userId }, "WebSocket connected");

    if (wasOffline) {
      broadcastToUsers(listConversationPartnerIds(userId), {
        type: "presence:update",
        payload: { userId, status: "online", lastSeenAt: Date.now() },
      });
    }

    socket.on("message", (raw: Buffer) => {
      handleClientMessage(userId, socket, raw.toString());
    });

    socket.on("close", () => {
      removeConnection(userId, socket);
      app.log.info({ userId }, "WebSocket disconnected");
      if (!isUserOnline(userId)) {
        broadcastToUsers(listConversationPartnerIds(userId), {
          type: "presence:update",
          payload: { userId, status: "offline", lastSeenAt: Date.now() },
        });
      }
      handleGameDisconnect(userId);
    });
  });
});
