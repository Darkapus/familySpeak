import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/guard.js";
import { getConversationWithMembers, isMember } from "../conversations/repository.js";
import { notifyOfflineMembers } from "../push/notify.js";
import { triggerHermesAutoReply } from "../hermes/autoReply.js";
import { broadcastToUsers } from "../../ws/registry.js";
import { createTextMessage, listMessages } from "./repository.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function registerMessageRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string }; Querystring: { before?: string; limit?: string } }>(
    "/:id/messages",
    { preHandler: requireAuth },
    async (request, reply) => {
      const conversation = getConversationWithMembers(request.params.id);
      if (!conversation) {
        return reply.code(404).send({ error: "Conversation introuvable" });
      }
      if (!isMember(conversation.id, request.user.sub)) {
        return reply.code(403).send({ error: "forbidden" });
      }

      const before = request.query.before ? Number(request.query.before) : undefined;
      const limit = request.query.limit ? Math.min(Number(request.query.limit), MAX_LIMIT) : DEFAULT_LIMIT;

      return listMessages(conversation.id, { before, limit });
    },
  );

  app.post<{ Params: { id: string }; Body: { content: string } }>(
    "/:id/messages",
    { preHandler: requireAuth },
    async (request, reply) => {
      const conversation = getConversationWithMembers(request.params.id);
      if (!conversation) {
        return reply.code(404).send({ error: "Conversation introuvable" });
      }
      if (!isMember(conversation.id, request.user.sub)) {
        return reply.code(403).send({ error: "forbidden" });
      }

      const content = request.body?.content?.trim();
      if (!content) {
        return reply.code(400).send({ error: "content requis" });
      }

      const message = createTextMessage({ conversationId: conversation.id, senderId: request.user.sub, content });

      broadcastToUsers(
        conversation.members.map((m) => m.id),
        { type: "message:new", payload: { message } },
      );
      notifyOfflineMembers(conversation, message);
      triggerHermesAutoReply(conversation, message);

      return reply.code(201).send({ message });
    },
  );
}
