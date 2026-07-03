import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/guard.js";
import { findUserById } from "../users/repository.js";
import {
  addMemberToConversation,
  createConversation,
  findDirectConversationBetween,
  getConversationWithMembers,
  isMember,
  listConversationsForUser,
} from "./repository.js";
import type { ConversationType } from "@familyspeak/shared";

export async function registerConversationRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: requireAuth }, async (request) => {
    return { conversations: listConversationsForUser(request.user.sub) };
  });

  app.get<{ Params: { id: string } }>("/:id", { preHandler: requireAuth }, async (request, reply) => {
    const conversation = getConversationWithMembers(request.params.id);
    if (!conversation) {
      return reply.code(404).send({ error: "Conversation introuvable" });
    }
    if (!isMember(conversation.id, request.user.sub)) {
      return reply.code(403).send({ error: "forbidden" });
    }
    return { conversation };
  });

  app.post<{ Body: { type: ConversationType; memberIds: string[]; name?: string } }>(
    "/",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { type, name } = request.body ?? {};
      const memberIds = (request.body?.memberIds ?? []).filter((id) => id !== request.user.sub);

      if (type !== "direct" && type !== "group") {
        return reply.code(400).send({ error: "type doit être 'direct' ou 'group'" });
      }
      if (memberIds.length === 0) {
        return reply.code(400).send({ error: "Au moins un autre membre est requis" });
      }
      for (const memberId of memberIds) {
        if (!findUserById(memberId)) {
          return reply.code(400).send({ error: `Utilisateur introuvable: ${memberId}` });
        }
      }

      if (type === "direct") {
        if (memberIds.length !== 1) {
          return reply.code(400).send({ error: "Une conversation directe nécessite exactement un autre membre" });
        }
        const existing = findDirectConversationBetween(request.user.sub, memberIds[0]!);
        if (existing) {
          return reply.send({ conversation: existing });
        }
        const conversation = createConversation({
          type: "direct",
          name: null,
          createdBy: request.user.sub,
          memberIds: [request.user.sub, memberIds[0]!],
        });
        return reply.code(201).send({ conversation });
      }

      if (!name || !name.trim()) {
        return reply.code(400).send({ error: "Un nom de groupe est requis" });
      }
      const conversation = createConversation({
        type: "group",
        name: name.trim(),
        createdBy: request.user.sub,
        memberIds: [request.user.sub, ...memberIds],
      });
      return reply.code(201).send({ conversation });
    },
  );

  app.post<{ Params: { id: string }; Body: { userId: string } }>(
    "/:id/members",
    { preHandler: requireAuth },
    async (request, reply) => {
      const conversation = getConversationWithMembers(request.params.id);
      if (!conversation) {
        return reply.code(404).send({ error: "Conversation introuvable" });
      }
      if (!isMember(conversation.id, request.user.sub)) {
        return reply.code(403).send({ error: "forbidden" });
      }
      if (conversation.type !== "group") {
        return reply.code(400).send({ error: "Impossible d'ajouter un membre à une conversation directe" });
      }
      const { userId } = request.body ?? {};
      if (!userId || !findUserById(userId)) {
        return reply.code(400).send({ error: "userId invalide" });
      }

      addMemberToConversation(conversation.id, userId);
      return { conversation: getConversationWithMembers(conversation.id) };
    },
  );
}
