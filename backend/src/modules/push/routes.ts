import type { FastifyInstance } from "fastify";
import { env } from "../../config/env.js";
import { requireAuth } from "../auth/guard.js";
import { deletePushSubscriptionByEndpoint, upsertPushSubscription } from "./repository.js";

interface SubscribeBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function registerPushRoutes(app: FastifyInstance) {
  app.get("/public-key", async () => {
    return { publicKey: env.vapidPublicKey };
  });

  app.post<{ Body: SubscribeBody }>("/subscribe", { preHandler: requireAuth }, async (request, reply) => {
    const { endpoint, keys } = request.body ?? {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return reply.code(400).send({ error: "Abonnement push invalide" });
    }
    upsertPushSubscription({ userId: request.user.sub, endpoint, keysP256dh: keys.p256dh, keysAuth: keys.auth });
    return reply.code(204).send();
  });

  app.post<{ Body: { endpoint: string } }>("/unsubscribe", { preHandler: requireAuth }, async (request, reply) => {
    const { endpoint } = request.body ?? {};
    if (endpoint) {
      deletePushSubscriptionByEndpoint(endpoint);
    }
    return reply.code(204).send();
  });
}
