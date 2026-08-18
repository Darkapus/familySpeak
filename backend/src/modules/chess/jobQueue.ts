import { broadcastToUsers } from "../../ws/registry.js";
import { analyzeGame } from "./analysis.js";
import {
  claimNextPendingJob,
  getGameById,
  markJobDone,
  markJobFailed,
  resetStuckProcessingJobs,
  updateGameAnalysisStatus,
} from "./repository.js";

const POLL_INTERVAL_MS = 5_000;
const MAX_ATTEMPTS = 3;

let loopStarted = false;
// Un seul job à la fois dans ce process (un seul process Stockfish natif en même temps) — sans
// ce garde, un import de 100+ parties chess.com démarrerait un nouveau job (et donc un nouveau
// process Stockfish) à chaque tick de 5s tant que le précédent n'est pas encore "done" en base,
// saturant le PC qui héberge aussi Caddy et le reste du backend.
let processing = false;

async function tick(): Promise<void> {
  if (processing) return;
  const job = claimNextPendingJob();
  if (!job) return;

  processing = true;
  try {
    await analyzeGame(job.gameId);
    markJobDone(job.id);
  } catch (err) {
    console.error(`Échec de l'analyse de la partie ${job.gameId} (tentative ${job.attempts}):`, err);
    markJobFailed(job.id, err instanceof Error ? err.message : String(err), job.attempts, MAX_ATTEMPTS);
    if (job.attempts >= MAX_ATTEMPTS) {
      const game = getGameById(job.gameId);
      updateGameAnalysisStatus(job.gameId, "failed");
      if (game) {
        broadcastToUsers([game.userId], {
          type: "chess:job-updated",
          payload: { gameId: job.gameId, userId: game.userId, status: "failed" },
        });
      }
    }
  } finally {
    processing = false;
  }
}

/** Démarre la boucle de traitement de la queue d'analyse. Idempotent, calquée sur
 * startMoveFlushLoop() du module game. Remet les jobs "processing" orphelins (backend tué en
 * plein traitement) à "pending" au démarrage — sûr car un seul backend tourne en production. */
export function startAnalysisJobLoop(): void {
  if (loopStarted) return;
  loopStarted = true;
  resetStuckProcessingJobs();
  setInterval(() => void tick(), POLL_INTERVAL_MS);
}
