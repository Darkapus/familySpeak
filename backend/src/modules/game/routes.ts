import type { FastifyInstance } from "fastify";
import { CHUNK_SIZE, GAME_WORLD_SEED, GAME_WORLD_SIZE_X, GAME_WORLD_SIZE_Z } from "@familyspeak/shared";
import type { WorldBlockDTO } from "@familyspeak/shared";
import { env } from "../../config/env.js";
import { requireAuth } from "../auth/guard.js";
import { listPlayerHomes, listWorldBlocksInChunk } from "./repository.js";
import { startMoveFlushLoop } from "./liveState.js";

const TOTAL_CHUNKS_X = GAME_WORLD_SIZE_X / CHUNK_SIZE;
const TOTAL_CHUNKS_Z = GAME_WORLD_SIZE_Z / CHUNK_SIZE;

export async function registerGameRoutes(app: FastifyInstance) {
  app.get("/world-info", { preHandler: requireAuth }, async (_request, reply) => {
    if (!env.gameEnabled) {
      return reply.code(403).send({ error: "Jeu désactivé" });
    }
    return { seed: GAME_WORLD_SEED, homes: listPlayerHomes() };
  });

  app.get<{ Querystring: { coords?: string } }>(
    "/chunks",
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!env.gameEnabled) {
        return reply.code(403).send({ error: "Jeu désactivé" });
      }

      const raw = request.query.coords ?? "";
      const chunks: Record<string, WorldBlockDTO[]> = {};
      for (const token of raw.split(",")) {
        if (!token) continue;
        const [cxStr, czStr] = token.split("_");
        const cx = Number(cxStr);
        const cz = Number(czStr);
        if (
          !Number.isInteger(cx) ||
          !Number.isInteger(cz) ||
          cx < 0 ||
          cx >= TOTAL_CHUNKS_X ||
          cz < 0 ||
          cz >= TOTAL_CHUNKS_Z
        ) {
          continue;
        }
        chunks[token] = listWorldBlocksInChunk(cx, cz);
      }
      return { chunks };
    },
  );

  startMoveFlushLoop();
}
