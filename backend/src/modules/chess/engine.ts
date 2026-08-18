import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { env } from "../../config/env.js";

export interface EngineScore {
  type: "cp" | "mate";
  value: number;
}

export interface EngineEvaluation {
  bestMoveUci: string;
  score: EngineScore;
}

const MATE_SCORE_BASE = 100000;
// Marge au-delà de movetime avant de considérer le moteur comme bloqué — évite qu'un
// CHESS_ANALYSIS_ENGINE_PATH invalide ou un process figé ne bloque la queue de jobs indéfiniment.
const WATCHDOG_MARGIN_MS = 15_000;

/** Normalise un score moteur (cp ou mat) en équivalent centipions, pour réutiliser les mêmes
 * seuils de classification (classifyMoveQuality) dans les deux cas. */
export function normalizeScoreToCentipawns(score: EngineScore): number {
  if (score.type === "cp") return score.value;
  return score.value > 0 ? MATE_SCORE_BASE - score.value * 100 : -MATE_SCORE_BASE - score.value * 100;
}

/**
 * Wrapper UCI autour d'un process Stockfish natif (backend uniquement, jamais côté client — le
 * jeu en direct utilise Stockfish WASM dans le navigateur). Un seul process est réutilisé pour
 * toute la durée de l'analyse d'une partie (une position par appel evaluate()) plutôt que d'en
 * relancer un par coup, beaucoup trop lent sur ~80 coups. Toujours démarré à la demande, jamais
 * au boot du serveur, pour qu'un CHESS_ANALYSIS_ENGINE_PATH mal configuré ne casse jamais le
 * healthcheck.
 */
export class StockfishEngine {
  private process: ChildProcessWithoutNullStreams | null = null;
  private onLine: ((line: string) => void) | null = null;
  private onFailure: ((err: Error) => void) | null = null;

  async start(): Promise<void> {
    const proc = spawn(env.chessAnalysisEnginePath, [], { stdio: ["pipe", "pipe", "pipe"] });
    this.process = proc;
    createInterface({ input: proc.stdout }).on("line", (line) => this.onLine?.(line));
    proc.stderr.on("data", (chunk: Buffer) => console.error("[stockfish]", chunk.toString()));
    proc.on("error", (err) => this.onFailure?.(err));
    proc.on("exit", (code) => {
      if (code !== null && code !== 0) this.onFailure?.(new Error(`Le process Stockfish s'est arrêté (code ${code})`));
    });

    await this.waitForLine("uci", (line) => line === "uciok", 10_000);
    await this.waitForLine("isready", (line) => line === "readyok", 10_000);
  }

  stop(): void {
    this.process?.stdin.write("quit\n");
    this.process?.kill();
    this.process = null;
    this.onLine = null;
    this.onFailure = null;
  }

  private send(command: string): void {
    if (!this.process) throw new Error("Moteur Stockfish non démarré");
    this.process.stdin.write(`${command}\n`);
  }

  private waitForLine(command: string, isMatch: (line: string) => boolean, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Stockfish n'a pas répondu à "${command}" à temps`)), timeoutMs);
      this.onFailure = (err) => {
        clearTimeout(timer);
        reject(err);
      };
      this.onLine = (line) => {
        if (isMatch(line)) {
          clearTimeout(timer);
          this.onLine = null;
          resolve(line);
        }
      };
      this.send(command);
    });
  }

  /** Évalue une position (score + meilleur coup, du point de vue du camp au trait dans ce FEN). */
  async evaluate(fen: string, options: { depth: number; moveTimeMs: number }): Promise<EngineEvaluation> {
    this.send("ucinewgame");
    await this.waitForLine("isready", (line) => line === "readyok", 10_000);
    this.send(`position fen ${fen}`);

    let lastScore: EngineScore = { type: "cp", value: 0 };
    const bestMoveLine = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Stockfish n'a pas renvoyé bestmove à temps")),
        options.moveTimeMs + WATCHDOG_MARGIN_MS,
      );
      this.onFailure = (err) => {
        clearTimeout(timer);
        reject(err);
      };
      this.onLine = (line) => {
        const scoreMatch = /score (cp|mate) (-?\d+)/.exec(line);
        if (scoreMatch) {
          lastScore = { type: scoreMatch[1] as "cp" | "mate", value: Number(scoreMatch[2]) };
        }
        if (line.startsWith("bestmove")) {
          clearTimeout(timer);
          this.onLine = null;
          resolve(line);
        }
      };
      this.send(`go depth ${options.depth} movetime ${options.moveTimeMs}`);
    });

    const bestMoveUci = bestMoveLine.split(" ")[1] ?? "0000";
    return { bestMoveUci, score: lastScore };
  }
}
