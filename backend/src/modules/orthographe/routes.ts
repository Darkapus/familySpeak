import type { FastifyInstance } from "fastify";
import { isOrthoCategory } from "@familyspeak/shared";
import { requireAuth } from "../auth/guard.js";
import { getStats, recordAttempt } from "./repository.js";

export async function registerOrthographeRoutes(app: FastifyInstance) {
  app.post<{ Body: { itemId: string; category: string; correct: boolean } }>(
    "/attempts",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { itemId, category, correct } = request.body ?? {};
      if (typeof itemId !== "string" || itemId.length === 0 || itemId.length > 64) {
        return reply.code(400).send({ error: "Exercice invalide" });
      }
      if (!isOrthoCategory(category)) return reply.code(400).send({ error: "Catégorie invalide" });
      if (typeof correct !== "boolean") return reply.code(400).send({ error: "Résultat invalide" });

      recordAttempt({ userId: request.user.sub, itemId, category, correct });
      return { ok: true };
    },
  );

  // Un parent peut consulter les progrès d'un enfant (comme pour les échecs) ; un enfant ne voit que les siens.
  app.get<{ Querystring: { userId?: string } }>("/stats", { preHandler: requireAuth }, async (request, reply) => {
    const targetUserId = request.query.userId ?? request.user.sub;
    if (targetUserId !== request.user.sub && request.user.role !== "parent") {
      return reply.code(403).send({ error: "forbidden" });
    }
    return getStats(targetUserId);
  });
}
