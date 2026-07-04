import type { FastifyInstance } from "fastify";
import { GAME_WORLD_SEED } from "@familyspeak/shared";
import { env } from "../../config/env.js";
import { requireAuth } from "../auth/guard.js";
import { listWorldBlocks } from "./repository.js";
import { startMoveFlushLoop } from "./liveState.js";

export async function registerGameRoutes(app: FastifyInstance) {
  app.get("/world", { preHandler: requireAuth }, async (_request, reply) => {
    if (!env.gameEnabled) {
      return reply.code(403).send({ error: "Jeu désactivé" });
    }
    return { seed: GAME_WORLD_SEED, blocks: listWorldBlocks() };
  });

  startMoveFlushLoop();
}
