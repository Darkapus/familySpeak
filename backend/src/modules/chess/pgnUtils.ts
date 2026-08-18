import { Chess } from "chess.js";
import type { ChessGameResult, ChessPlayerColor } from "@familyspeak/shared";

export interface ReplayedMove {
  ply: number;
  movedBy: ChessPlayerColor;
  fenBefore: string;
  fenAfter: string;
  moveSan: string;
  moveUci: string;
}

/** true si le PGN est syntaxiquement valide et rejouable par chess.js. */
export function isParsablePgn(pgn: string): boolean {
  try {
    new Chess().loadPgn(pgn);
    return true;
  } catch {
    return false;
  }
}

export function normalizeResultHeader(raw: string | null | undefined): ChessGameResult {
  return raw === "1-0" || raw === "0-1" || raw === "1/2-1/2" ? raw : "*";
}

export function parsePgnHeaders(pgn: string): Record<string, string | null> {
  const chess = new Chess();
  chess.loadPgn(pgn);
  return chess.header();
}

/** Devine la couleur jouée par l'enfant en comparant son pseudo chess.com (insensible à la
 * casse) aux en-têtes White/Black du PGN. */
export function detectPlayerColorFromHeaders(
  headers: Record<string, string | null>,
  chessComUsername: string,
): ChessPlayerColor | null {
  const uname = chessComUsername.toLowerCase();
  if (headers.White?.toLowerCase() === uname) return "white";
  if (headers.Black?.toLowerCase() === uname) return "black";
  return null;
}

/** Rejoue un PGN coup par coup et capture le FEN avant/après chaque coup — utilisé par
 * l'analyse Stockfish (un appel moteur par position). Ne dépend d'aucun champ verbeux
 * spécifique à une version de chess.js : ne s'appuie que sur move()/fen()/header(), stables
 * depuis toujours dans cette librairie. */
export function replayPgnMoves(pgn: string): ReplayedMove[] {
  const parser = new Chess();
  parser.loadPgn(pgn);
  const sanMoves = parser.history();
  const headers = parser.header();

  const chess = headers.FEN ? new Chess(headers.FEN) : new Chess();
  const moves: ReplayedMove[] = [];
  for (const san of sanMoves) {
    const movedBy: ChessPlayerColor = chess.turn() === "w" ? "white" : "black";
    const fenBefore = chess.fen();
    const result = chess.move(san);
    const fenAfter = chess.fen();
    moves.push({
      ply: moves.length + 1,
      movedBy,
      fenBefore,
      fenAfter,
      moveSan: result.san,
      moveUci: `${result.from}${result.to}${result.promotion ?? ""}`,
    });
  }
  return moves;
}
