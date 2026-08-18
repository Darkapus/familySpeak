import { Chess } from "chess.js";
import { classifyMoveQuality } from "@familyspeak/shared";
import { env } from "../../config/env.js";
import { broadcastToUsers } from "../../ws/registry.js";
import { StockfishEngine, normalizeScoreToCentipawns } from "./engine.js";
import type { EngineEvaluation } from "./engine.js";
import { categorizeMistake } from "./mistakeHeuristics.js";
import { replayPgnMoves } from "./pgnUtils.js";
import { maybeGenerateLessonForCategory } from "./lessonGeneration.js";
import { bumpWeaknessProfile, deleteMoveEvalsForGame, getGameById, insertMoveEvals, updateGameAnalysisStatus } from "./repository.js";

function uciToSan(fen: string, uci: string): string {
  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.slice(4, 5) || undefined;
    const result = chess.move({ from, to, promotion });
    return result.san;
  } catch {
    return uci;
  }
}

/**
 * Analyse une partie coup par coup avec Stockfish natif. Un seul appel moteur par position
 * distincte (l'éval "après" du ply N est l'éval "avant" du ply N+1), pas deux par coup.
 */
export async function analyzeGame(gameId: string): Promise<void> {
  const game = getGameById(gameId);
  if (!game) return;

  const moves = replayPgnMoves(game.pgn);
  if (moves.length === 0) {
    updateGameAnalysisStatus(gameId, "done");
    return;
  }

  updateGameAnalysisStatus(gameId, "analyzing");
  broadcastToUsers([game.userId], {
    type: "chess:job-updated",
    payload: { gameId, userId: game.userId, status: "analyzing" },
  });

  const fens = [...moves.map((m) => m.fenBefore), moves[moves.length - 1]!.fenAfter];
  const engine = new StockfishEngine();
  await engine.start();
  const evaluations: EngineEvaluation[] = [];
  try {
    for (const fen of fens) {
      evaluations.push(
        await engine.evaluate(fen, { depth: env.chessAnalysisDepth, moveTimeMs: env.chessAnalysisMoveTimeMs }),
      );
    }
  } finally {
    engine.stop();
  }

  deleteMoveEvalsForGame(gameId);
  const rows = moves.map((move, i) => {
    const before = evaluations[i]!;
    const after = evaluations[i + 1]!;
    const evalBeforeCp = normalizeScoreToCentipawns(before.score);
    // Le score "après" est du point de vue de l'adversaire (à qui c'est le tour) : on le
    // reconvertit du point de vue de l'auteur du coup pour pouvoir comparer les deux évals.
    const evalAfterCp = -normalizeScoreToCentipawns(after.score);
    const centipawnLoss = Math.max(0, evalBeforeCp - evalAfterCp);
    const quality = classifyMoveQuality(centipawnLoss);
    const bestMoveSan = uciToSan(move.fenBefore, before.bestMoveUci);
    const mistakeCategory =
      quality === "mistake" || quality === "blunder"
        ? categorizeMistake({
            fenBefore: move.fenBefore,
            fenAfter: move.fenAfter,
            moveSan: move.moveSan,
            moveUci: move.moveUci,
            bestMoveSan,
            bestMoveUci: before.bestMoveUci,
            beforeScore: before.score,
          })
        : null;

    return {
      gameId,
      userId: game.userId,
      ply: move.ply,
      movedBy: move.movedBy,
      fenBefore: move.fenBefore,
      moveSan: move.moveSan,
      moveUci: move.moveUci,
      bestMoveSan,
      bestMoveUci: before.bestMoveUci,
      evalBeforeCp,
      evalAfterCp,
      centipawnLoss,
      quality,
      mistakeCategory,
    };
  });

  insertMoveEvals(rows);

  // Le profil de faiblesses ne porte que sur les coups joués par l'enfant, pas ceux de
  // l'adversaire (partie chess.com) ou du moteur (partie live) — sinon on mélangerait les
  // erreurs des deux camps.
  for (const row of rows) {
    if (row.movedBy !== game.playerColor || !row.mistakeCategory) continue;
    bumpWeaknessProfile(game.userId, row.mistakeCategory, row.centipawnLoss);
    // maybeGenerateLessonForCategory décide elle-même si le seuil est atteint et si le délai
    // depuis la dernière leçon de cette catégorie est passé — pas besoin de ne l'appeler que sur
    // un franchissement exact d'un multiple ici.
    void maybeGenerateLessonForCategory(game.userId, row.mistakeCategory).catch((err) =>
      console.error("Échec de la génération de leçon (tâche de fond):", err),
    );
  }

  updateGameAnalysisStatus(gameId, "done");
  broadcastToUsers([game.userId], { type: "chess:job-updated", payload: { gameId, userId: game.userId, status: "done" } });
}
