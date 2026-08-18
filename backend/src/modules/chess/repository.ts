import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  chessAnalysisJobs,
  chessGames,
  chessLessons,
  chessMoveEvals,
  chessWeaknessProfile,
} from "../../db/schema.js";
import type {
  ChessAnalysisStatus,
  ChessGameDTO,
  ChessLessonDTO,
  ChessMoveEvalDTO,
  ChessPlayerColor,
  ChessWeaknessProfileEntryDTO,
  MoveQuality,
  WeaknessCategory,
} from "@familyspeak/shared";

type ChessGameRow = typeof chessGames.$inferSelect;
type ChessMoveEvalRow = typeof chessMoveEvals.$inferSelect;
type ChessLessonRow = typeof chessLessons.$inferSelect;

function gameToDTO(row: ChessGameRow): ChessGameDTO {
  return {
    id: row.id,
    userId: row.userId,
    source: row.source,
    chessComUsername: row.chessComUsername,
    chessComGameUrl: row.chessComGameUrl,
    pgn: row.pgn,
    result: row.result,
    playerColor: row.playerColor,
    opponentName: row.opponentName,
    timeControl: row.timeControl,
    engineLevel: row.engineLevel,
    playedAt: row.playedAt,
    analysisStatus: row.analysisStatus,
    analyzedAt: row.analyzedAt,
    createdAt: row.createdAt,
  };
}

function moveEvalToDTO(row: ChessMoveEvalRow): ChessMoveEvalDTO {
  return {
    id: row.id,
    gameId: row.gameId,
    ply: row.ply,
    movedBy: row.movedBy,
    fenBefore: row.fenBefore,
    moveSan: row.moveSan,
    moveUci: row.moveUci,
    bestMoveSan: row.bestMoveSan,
    bestMoveUci: row.bestMoveUci,
    evalBeforeCp: row.evalBeforeCp,
    evalAfterCp: row.evalAfterCp,
    centipawnLoss: row.centipawnLoss,
    quality: row.quality,
    mistakeCategory: row.mistakeCategory,
  };
}

function lessonToDTO(row: ChessLessonRow): ChessLessonDTO {
  return {
    id: row.id,
    userId: row.userId,
    category: row.category,
    title: row.title,
    contentMarkdown: row.contentMarkdown,
    exampleGameId: row.exampleGameId,
    examplePly: row.examplePly,
    readAt: row.readAt,
    generatedAt: row.generatedAt,
  };
}

export function createLiveGame(input: {
  userId: string;
  pgn: string;
  result: ChessGameDTO["result"];
  playerColor: ChessPlayerColor;
  engineLevel: number;
}): ChessGameDTO {
  const row: ChessGameRow = {
    id: crypto.randomUUID(),
    userId: input.userId,
    source: "live",
    chessComUsername: null,
    chessComGameUrl: null,
    pgn: input.pgn,
    result: input.result,
    playerColor: input.playerColor,
    opponentName: `Stockfish (niveau ${input.engineLevel})`,
    timeControl: null,
    engineLevel: input.engineLevel,
    playedAt: Date.now(),
    analysisStatus: "none",
    analyzedAt: null,
    createdAt: Date.now(),
  };
  db.insert(chessGames).values(row).run();
  return gameToDTO(row);
}

export function insertImportedGame(input: {
  userId: string;
  chessComUsername: string;
  chessComGameUrl: string;
  pgn: string;
  result: ChessGameDTO["result"];
  playerColor: ChessPlayerColor;
  opponentName: string | null;
  timeControl: string | null;
  playedAt: number;
}): ChessGameDTO | null {
  const row: ChessGameRow = {
    id: crypto.randomUUID(),
    userId: input.userId,
    source: "chess_com",
    chessComUsername: input.chessComUsername,
    chessComGameUrl: input.chessComGameUrl,
    pgn: input.pgn,
    result: input.result,
    playerColor: input.playerColor,
    opponentName: input.opponentName,
    timeControl: input.timeControl,
    engineLevel: null,
    playedAt: input.playedAt,
    analysisStatus: "none",
    analyzedAt: null,
    createdAt: Date.now(),
  };
  const inserted = db.insert(chessGames).values(row).onConflictDoNothing().run();
  return inserted.changes > 0 ? gameToDTO(row) : null;
}

export function listGamesForUser(
  userId: string,
  options: { before?: number; limit: number },
): { games: ChessGameDTO[]; nextBefore: number | null } {
  const conditions = [eq(chessGames.userId, userId)];
  if (options.before !== undefined) {
    conditions.push(lt(chessGames.playedAt, options.before));
  }
  const rows = db
    .select()
    .from(chessGames)
    .where(and(...conditions))
    .orderBy(desc(chessGames.playedAt))
    .limit(options.limit)
    .all();
  const nextBefore = rows.length === options.limit ? rows[rows.length - 1]!.playedAt : null;
  return { games: rows.map(gameToDTO), nextBefore };
}

export function getGameById(id: string): ChessGameDTO | undefined {
  const row = db.select().from(chessGames).where(eq(chessGames.id, id)).get();
  return row ? gameToDTO(row) : undefined;
}

/** Ne garde que les `keep` parties chess.com les plus récentes d'un utilisateur (toutes sources
 * chess_com confondues, quel que soit le pseudo importé) et supprime les autres en cascade
 * (leçons qui les référencent, coups analysés, jobs, puis la partie elle-même) — dans cet ordre
 * à cause des clés étrangères (foreign_keys = ON). Les vieilles parties d'un historique complet
 * n'ont aucun intérêt pédagogique (niveau d'il y a des mois/années) et ne devraient pas rester à
 * analyser ni polluer le profil de faiblesses. */
export function pruneOldChessComGames(userId: string, keep: number): void {
  const rows = db
    .select({ id: chessGames.id })
    .from(chessGames)
    .where(and(eq(chessGames.userId, userId), eq(chessGames.source, "chess_com")))
    .orderBy(desc(chessGames.playedAt))
    .all();
  const toDelete = rows.slice(keep).map((r) => r.id);
  if (toDelete.length === 0) return;

  db.delete(chessLessons).where(inArray(chessLessons.exampleGameId, toDelete)).run();
  db.delete(chessMoveEvals).where(inArray(chessMoveEvals.gameId, toDelete)).run();
  db.delete(chessAnalysisJobs).where(inArray(chessAnalysisJobs.gameId, toDelete)).run();
  db.delete(chessGames).where(inArray(chessGames.id, toDelete)).run();
}

export function updateGameAnalysisStatus(gameId: string, status: ChessAnalysisStatus): void {
  db.update(chessGames)
    .set({ analysisStatus: status, analyzedAt: status === "done" ? Date.now() : null })
    .where(eq(chessGames.id, gameId))
    .run();
}

export function insertMoveEvals(
  rows: Array<{
    gameId: string;
    userId: string;
    ply: number;
    movedBy: ChessPlayerColor;
    fenBefore: string;
    moveSan: string;
    moveUci: string;
    bestMoveSan: string;
    bestMoveUci: string;
    evalBeforeCp: number;
    evalAfterCp: number;
    centipawnLoss: number;
    quality: MoveQuality;
    mistakeCategory: WeaknessCategory | null;
  }>,
): void {
  if (rows.length === 0) return;
  db.insert(chessMoveEvals)
    .values(rows.map((row) => ({ id: crypto.randomUUID(), ...row })))
    .run();
}

export function deleteMoveEvalsForGame(gameId: string): void {
  db.delete(chessMoveEvals).where(eq(chessMoveEvals.gameId, gameId)).run();
}

export function listMoveEvalsForGame(gameId: string): ChessMoveEvalDTO[] {
  return db
    .select()
    .from(chessMoveEvals)
    .where(eq(chessMoveEvals.gameId, gameId))
    .orderBy(chessMoveEvals.ply)
    .all()
    .map(moveEvalToDTO);
}

export function listWorstMovesForCategory(
  userId: string,
  category: WeaknessCategory,
  limit: number,
): ChessMoveEvalDTO[] {
  return db
    .select()
    .from(chessMoveEvals)
    .where(and(eq(chessMoveEvals.userId, userId), eq(chessMoveEvals.mistakeCategory, category)))
    .orderBy(desc(chessMoveEvals.centipawnLoss))
    .limit(limit)
    .all()
    .map(moveEvalToDTO);
}

/** Upsert incrémental (occurrenceCount += 1) — seule table du module qui dévie du pattern
 * "set littéral" utilisé ailleurs (upsertPlayerHome/upsertWorldBlock), car le profil de
 * faiblesses doit accumuler les occurrences plutôt que remplacer la dernière valeur. */
export function bumpWeaknessProfile(userId: string, category: WeaknessCategory, centipawnLoss: number): void {
  const now = Date.now();
  db.insert(chessWeaknessProfile)
    .values({ userId, category, occurrenceCount: 1, totalCentipawnLoss: centipawnLoss, lastOccurredAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [chessWeaknessProfile.userId, chessWeaknessProfile.category],
      set: {
        occurrenceCount: sql`${chessWeaknessProfile.occurrenceCount} + 1`,
        totalCentipawnLoss: sql`${chessWeaknessProfile.totalCentipawnLoss} + ${centipawnLoss}`,
        lastOccurredAt: now,
        updatedAt: now,
      },
    })
    .run();
}

/** Reconstruit entièrement le profil de faiblesses d'un utilisateur à partir des
 * chess_move_evals actuellement en base (après un pruneOldChessComGames par exemple, où les
 * compteurs incrémentaux de bumpWeaknessProfile ne peuvent plus être décrémentés proprement). */
export function recomputeWeaknessProfile(userId: string): void {
  const games = db.select().from(chessGames).where(eq(chessGames.userId, userId)).all();
  const totals = new Map<WeaknessCategory, { count: number; loss: number; lastAt: number }>();
  for (const game of games) {
    const moves = db.select().from(chessMoveEvals).where(eq(chessMoveEvals.gameId, game.id)).all();
    for (const move of moves) {
      if (move.movedBy !== game.playerColor || !move.mistakeCategory) continue;
      const entry = totals.get(move.mistakeCategory) ?? { count: 0, loss: 0, lastAt: 0 };
      entry.count += 1;
      entry.loss += move.centipawnLoss;
      entry.lastAt = Math.max(entry.lastAt, game.playedAt);
      totals.set(move.mistakeCategory, entry);
    }
  }

  db.delete(chessWeaknessProfile).where(eq(chessWeaknessProfile.userId, userId)).run();
  const now = Date.now();
  for (const [category, entry] of totals) {
    db.insert(chessWeaknessProfile)
      .values({
        userId,
        category,
        occurrenceCount: entry.count,
        totalCentipawnLoss: entry.loss,
        lastOccurredAt: entry.lastAt || now,
        updatedAt: now,
      })
      .run();
  }
}

export function listWeaknessProfile(userId: string): ChessWeaknessProfileEntryDTO[] {
  return db
    .select()
    .from(chessWeaknessProfile)
    .where(eq(chessWeaknessProfile.userId, userId))
    .orderBy(desc(chessWeaknessProfile.occurrenceCount))
    .all();
}

export function getWeaknessOccurrenceCount(userId: string, category: WeaknessCategory): number {
  const row = db
    .select({ occurrenceCount: chessWeaknessProfile.occurrenceCount })
    .from(chessWeaknessProfile)
    .where(and(eq(chessWeaknessProfile.userId, userId), eq(chessWeaknessProfile.category, category)))
    .get();
  return row?.occurrenceCount ?? 0;
}

// --- Queue d'analyse ---

export function enqueueAnalysisJob(gameId: string): void {
  db.insert(chessAnalysisJobs)
    .values({ id: crypto.randomUUID(), gameId, status: "pending", attempts: 0, createdAt: Date.now() })
    .onConflictDoNothing()
    .run();
  updateGameAnalysisStatus(gameId, "queued");
}

export function resetStuckProcessingJobs(): void {
  db.update(chessAnalysisJobs).set({ status: "pending" }).where(eq(chessAnalysisJobs.status, "processing")).run();
}

export function claimNextPendingJob(): { id: string; gameId: string; attempts: number } | undefined {
  const job = db
    .select({ id: chessAnalysisJobs.id, gameId: chessAnalysisJobs.gameId, attempts: chessAnalysisJobs.attempts })
    .from(chessAnalysisJobs)
    .where(eq(chessAnalysisJobs.status, "pending"))
    .orderBy(chessAnalysisJobs.createdAt)
    .limit(1)
    .get();
  if (!job) return undefined;
  const attempts = job.attempts + 1;
  db.update(chessAnalysisJobs)
    .set({ status: "processing", startedAt: Date.now(), attempts })
    .where(eq(chessAnalysisJobs.id, job.id))
    .run();
  return { ...job, attempts };
}

export function markJobDone(jobId: string): void {
  db.update(chessAnalysisJobs).set({ status: "done", finishedAt: Date.now() }).where(eq(chessAnalysisJobs.id, jobId)).run();
}

export function markJobFailed(jobId: string, error: string, attempts: number, maxAttempts: number): void {
  db.update(chessAnalysisJobs)
    .set({
      status: attempts >= maxAttempts ? "failed" : "pending",
      lastError: error,
      finishedAt: attempts >= maxAttempts ? Date.now() : null,
    })
    .where(eq(chessAnalysisJobs.id, jobId))
    .run();
}

// --- Leçons ---

export function insertLesson(input: {
  userId: string;
  category: WeaknessCategory;
  title: string;
  contentMarkdown: string;
  exampleGameId: string | null;
  examplePly: number | null;
}): ChessLessonDTO {
  const row: ChessLessonRow = {
    id: crypto.randomUUID(),
    userId: input.userId,
    category: input.category,
    title: input.title,
    contentMarkdown: input.contentMarkdown,
    exampleGameId: input.exampleGameId,
    examplePly: input.examplePly,
    readAt: null,
    generatedAt: Date.now(),
  };
  db.insert(chessLessons).values(row).run();
  return lessonToDTO(row);
}

export function getMostRecentLessonGeneratedAt(userId: string, category: WeaknessCategory): number | undefined {
  const row = db
    .select({ generatedAt: chessLessons.generatedAt })
    .from(chessLessons)
    .where(and(eq(chessLessons.userId, userId), eq(chessLessons.category, category)))
    .orderBy(desc(chessLessons.generatedAt))
    .limit(1)
    .get();
  return row?.generatedAt;
}

export function listLessonsForUser(userId: string): ChessLessonDTO[] {
  return db
    .select()
    .from(chessLessons)
    .where(eq(chessLessons.userId, userId))
    .orderBy(desc(chessLessons.generatedAt))
    .all()
    .map(lessonToDTO);
}

export function markLessonRead(lessonId: string, userId: string): void {
  db.update(chessLessons)
    .set({ readAt: Date.now() })
    .where(and(eq(chessLessons.id, lessonId), eq(chessLessons.userId, userId)))
    .run();
}
