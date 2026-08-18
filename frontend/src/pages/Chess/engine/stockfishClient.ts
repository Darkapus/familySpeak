import { CHESS_ENGINE_SKILL_MAX, CHESS_ENGINE_SKILL_MIN } from "@familyspeak/shared";

const ENGINE_SCRIPT_URL = "/stockfish/stockfish-18-lite-single.js";

/** Mappe le niveau enfant (1-8) sur le "Skill Level" UCI natif de Stockfish (0-20) : on ne
 * veut jamais exposer toute la plage, un enfant qui débute perd tout intérêt face à un
 * Stockfish plein régime au-delà d'un niveau modeste. */
function toUciSkillLevel(childLevel: number): number {
  const clamped = Math.min(CHESS_ENGINE_SKILL_MAX, Math.max(CHESS_ENGINE_SKILL_MIN, childLevel));
  const ratio = (clamped - CHESS_ENGINE_SKILL_MIN) / (CHESS_ENGINE_SKILL_MAX - CHESS_ENGINE_SKILL_MIN);
  return Math.round(ratio * 20);
}

/**
 * Wrapper UCI autour du Worker Stockfish WASM mono-thread (frontend/public/stockfish/, voir
 * scripts/fetch-stockfish.mjs). Utilisé uniquement pour le jeu en direct — l'analyse en masse
 * des parties tourne côté serveur sur un binaire natif (backend/src/modules/chess/engine.ts).
 */
export class ChessEngineClient {
  private worker: Worker;
  private readyPromise: Promise<void>;
  private pendingBestMove: ((uci: string) => void) | null = null;

  constructor() {
    this.worker = new Worker(ENGINE_SCRIPT_URL);
    this.worker.onmessage = (event: MessageEvent) => this.handleLine(String(event.data));
    this.readyPromise = this.handshake();
  }

  private post(command: string): void {
    this.worker.postMessage(command);
  }

  private handleLine(line: string): void {
    if (line.startsWith("bestmove")) {
      const uci = line.split(" ")[1] ?? "0000";
      this.pendingBestMove?.(uci);
      this.pendingBestMove = null;
    }
  }

  private waitForLine(isMatch: (line: string) => boolean): Promise<void> {
    return new Promise((resolve) => {
      const onMessage = (event: MessageEvent) => {
        if (isMatch(String(event.data))) {
          this.worker.removeEventListener("message", onMessage);
          resolve();
        }
      };
      this.worker.addEventListener("message", onMessage);
    });
  }

  private async handshake(): Promise<void> {
    const uciReady = this.waitForLine((line) => line.includes("uciok"));
    this.post("uci");
    await uciReady;
    const isReady = this.waitForLine((line) => line.includes("readyok"));
    this.post("isready");
    await isReady;
  }

  async setSkillLevel(childLevel: number): Promise<void> {
    await this.readyPromise;
    this.post(`setoption name Skill Level value ${toUciSkillLevel(childLevel)}`);
  }

  async getBestMove(fen: string, moveTimeMs = 600): Promise<string> {
    await this.readyPromise;
    return new Promise((resolve) => {
      this.pendingBestMove = resolve;
      this.post(`position fen ${fen}`);
      this.post(`go movetime ${moveTimeMs}`);
    });
  }

  destroy(): void {
    this.worker.terminate();
  }
}
