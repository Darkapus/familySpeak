import type { FastifyInstance, FastifyRequest } from "fastify";
import { CHESS_ENGINE_SKILL_MAX, CHESS_ENGINE_SKILL_MIN } from "@familyspeak/shared";
import type { ChessGameResult, ChessPlayerColor } from "@familyspeak/shared";
import { env } from "../../config/env.js";
import { requireAuth } from "../auth/guard.js";
import { ChessComUserNotFoundError, fetchRecentGames } from "./chessComClient.js";
import { detectPlayerColorFromHeaders, isParsablePgn, normalizeResultHeader, parsePgnHeaders } from "./pgnUtils.js";
import { askAboutPosition } from "./positionChat.js";
import { startAnalysisJobLoop } from "./jobQueue.js";
import { broadcastToUsers } from "../../ws/registry.js";
import {
  createLiveGame,
  enqueueAnalysisJob,
  getGameById,
  insertImportedGame,
  listGamesForUser,
  listLessonsForUser,
  listMoveEvalsForGame,
  listWeaknessProfile,
  markLessonRead,
} from "./repository.js";

// Les 10 dernières parties reflètent le niveau actuel de l'enfant ; tout l'historique d'un
// compte chess.com actif depuis des années serait beaucoup moins représentatif et beaucoup
// plus lourd à analyser.
const RECENT_GAMES_IMPORT_LIMIT = 10;

function canAccess(request: FastifyRequest, targetUserId: string): boolean {
  return request.user.sub === targetUserId || request.user.role === "parent";
}

export async function registerChessRoutes(app: FastifyInstance) {
  app.post<{ Body: { pgn: string; result: ChessGameResult; playerColor: ChessPlayerColor; engineLevel: number } }>(
    "/games",
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!env.chessEnabled) return reply.code(403).send({ error: "Module échecs désactivé" });

      const { pgn, result, playerColor, engineLevel } = request.body ?? {};
      if (typeof pgn !== "string" || !isParsablePgn(pgn)) {
        return reply.code(400).send({ error: "PGN invalide" });
      }
      if (!["1-0", "0-1", "1/2-1/2", "*"].includes(result)) {
        return reply.code(400).send({ error: "Résultat invalide" });
      }
      if (playerColor !== "white" && playerColor !== "black") {
        return reply.code(400).send({ error: "Couleur invalide" });
      }
      if (
        !Number.isInteger(engineLevel) ||
        engineLevel < CHESS_ENGINE_SKILL_MIN ||
        engineLevel > CHESS_ENGINE_SKILL_MAX
      ) {
        return reply.code(400).send({ error: "Niveau de moteur invalide" });
      }

      const game = createLiveGame({ userId: request.user.sub, pgn, result, playerColor, engineLevel });
      enqueueAnalysisJob(game.id);
      return { game };
    },
  );

  app.get<{ Querystring: { before?: string; limit?: string; userId?: string } }>(
    "/games",
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!env.chessEnabled) return reply.code(403).send({ error: "Module échecs désactivé" });

      const targetUserId = request.query.userId ?? request.user.sub;
      if (!canAccess(request, targetUserId)) return reply.code(403).send({ error: "forbidden" });

      const before = request.query.before ? Number(request.query.before) : undefined;
      const limit = Math.min(Number(request.query.limit ?? "20") || 20, 100);
      const { games, nextBefore } = listGamesForUser(targetUserId, { before, limit });
      return { games, nextBefore };
    },
  );

  app.get<{ Params: { id: string } }>("/games/:id", { preHandler: requireAuth }, async (request, reply) => {
    if (!env.chessEnabled) return reply.code(403).send({ error: "Module échecs désactivé" });
    const game = getGameById(request.params.id);
    if (!game) return reply.code(404).send({ error: "Partie introuvable" });
    if (!canAccess(request, game.userId)) return reply.code(403).send({ error: "forbidden" });
    return { game };
  });

  app.get<{ Params: { id: string } }>("/games/:id/analysis", { preHandler: requireAuth }, async (request, reply) => {
    if (!env.chessEnabled) return reply.code(403).send({ error: "Module échecs désactivé" });
    const game = getGameById(request.params.id);
    if (!game) return reply.code(404).send({ error: "Partie introuvable" });
    if (!canAccess(request, game.userId)) return reply.code(403).send({ error: "forbidden" });
    return { moves: listMoveEvalsForGame(game.id) };
  });

  app.post<{ Params: { id: string } }>("/games/:id/reanalyze", { preHandler: requireAuth }, async (request, reply) => {
    if (!env.chessEnabled) return reply.code(403).send({ error: "Module échecs désactivé" });
    const game = getGameById(request.params.id);
    if (!game) return reply.code(404).send({ error: "Partie introuvable" });
    if (!canAccess(request, game.userId)) return reply.code(403).send({ error: "forbidden" });
    enqueueAnalysisJob(game.id);
    return { ok: true };
  });

  app.post<{ Body: { username: string } }>("/import", { preHandler: requireAuth }, async (request, reply) => {
    if (!env.chessEnabled) return reply.code(403).send({ error: "Module échecs désactivé" });

    const username = request.body?.username?.trim();
    if (!username) return reply.code(400).send({ error: "Pseudo chess.com requis" });

    let games;
    try {
      games = await fetchRecentGames(username, RECENT_GAMES_IMPORT_LIMIT);
    } catch (err) {
      if (err instanceof ChessComUserNotFoundError) {
        return reply.code(400).send({ error: err.message });
      }
      request.log.error(err, "Échec de l'import chess.com");
      return reply.code(502).send({ error: "chess.com est indisponible, réessaie plus tard" });
    }

    let importedCount = 0;
    let skippedCount = 0;
    for (const remoteGame of games) {
      const headers = parsePgnHeaders(remoteGame.pgn);
      const color = detectPlayerColorFromHeaders(headers, username);
      if (!color) {
        skippedCount++;
        continue;
      }
      const inserted = insertImportedGame({
        userId: request.user.sub,
        chessComUsername: username,
        chessComGameUrl: remoteGame.url,
        pgn: remoteGame.pgn,
        result: normalizeResultHeader(headers.Result),
        playerColor: color,
        opponentName: color === "white" ? (remoteGame.black?.username ?? null) : (remoteGame.white?.username ?? null),
        timeControl: remoteGame.time_control ?? null,
        playedAt: remoteGame.end_time * 1000,
      });
      if (inserted) {
        importedCount++;
        enqueueAnalysisJob(inserted.id);
      } else {
        skippedCount++;
      }
    }

    broadcastToUsers([request.user.sub], {
      type: "chess:import-completed",
      payload: { userId: request.user.sub, importedCount, skippedCount },
    });
    return { importedCount, skippedCount };
  });

  app.get<{ Querystring: { userId?: string } }>("/weakness-profile", { preHandler: requireAuth }, async (request, reply) => {
    if (!env.chessEnabled) return reply.code(403).send({ error: "Module échecs désactivé" });
    const targetUserId = request.query.userId ?? request.user.sub;
    if (!canAccess(request, targetUserId)) return reply.code(403).send({ error: "forbidden" });
    return { profile: listWeaknessProfile(targetUserId) };
  });

  app.get<{ Querystring: { userId?: string } }>("/lessons", { preHandler: requireAuth }, async (request, reply) => {
    if (!env.chessEnabled) return reply.code(403).send({ error: "Module échecs désactivé" });
    const targetUserId = request.query.userId ?? request.user.sub;
    if (!canAccess(request, targetUserId)) return reply.code(403).send({ error: "forbidden" });
    return { lessons: listLessonsForUser(targetUserId) };
  });

  app.post<{ Params: { id: string } }>("/lessons/:id/read", { preHandler: requireAuth }, async (request, reply) => {
    if (!env.chessEnabled) return reply.code(403).send({ error: "Module échecs désactivé" });
    markLessonRead(request.params.id, request.user.sub);
    return { ok: true };
  });

  app.post<{
    Body: { fen: string; question: string; history?: Array<{ role: "user" | "assistant"; content: string }> };
  }>("/chat", { preHandler: requireAuth }, async (request, reply) => {
    if (!env.chessEnabled) return reply.code(403).send({ error: "Module échecs désactivé" });
    const { fen, question, history } = request.body ?? {};
    if (typeof fen !== "string" || typeof question !== "string" || !question.trim()) {
      return reply.code(400).send({ error: "fen et question requis" });
    }
    const answer = await askAboutPosition({ fen, question, history: history ?? [] });
    return { reply: answer };
  });

  startAnalysisJobLoop();
}
