import { Chess, type Square } from "chess.js";
import type { WeaknessCategory } from "@familyspeak/shared";
import type { EngineScore } from "./engine.js";

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function squaresOf(uci: string): { from: Square; to: Square } {
  return { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square };
}

function castlingRights(fen: string): string {
  return fen.split(" ")[2] ?? "-";
}

function countNonPawnMaterial(fen: string): number {
  const chess = new Chess(fen);
  let total = 0;
  for (const row of chess.board()) {
    for (const square of row) {
      if (square && square.type !== "p" && square.type !== "k") {
        total += PIECE_VALUES[square.type] ?? 0;
      }
    }
  }
  return total;
}

/** Le meilleur coup du moteur attaquait-il une pièce non défendue avec au moins un cavalier ?
 * Proxy volontairement simple pour "fourchette manquée" : on ne dispose pas d'une carte
 * d'attaques exposée publiquement par chess.js, donc on se limite à un signal robuste (coup de
 * cavalier qui capture) plutôt que de tenter une détection de fourchette exacte et fragile. */
function bestMoveLooksLikeMissedKnightTactic(fenBefore: string, bestMoveUci: string): boolean {
  const { from, to } = squaresOf(bestMoveUci);
  const chess = new Chess(fenBefore);
  const mover = chess.get(from);
  if (mover?.type !== "n") return false;
  const target = chess.get(to);
  return target !== undefined && target !== null;
}

/** Après le coup joué, l'adversaire a-t-il une capture gagnante sur une pièce non défendable ? */
function moveHangsAPiece(fenAfter: string): boolean {
  const chess = new Chess(fenAfter);
  const captures = chess.moves({ verbose: true }).filter((m) => m.captured);
  if (captures.length === 0) return false;

  let worst: { to: Square; capturedValue: number } | null = null;
  for (const capture of captures) {
    const capturedValue = PIECE_VALUES[capture.captured!] ?? 0;
    if (capturedValue >= 3 && (!worst || capturedValue > worst.capturedValue)) {
      worst = { to: capture.to as Square, capturedValue };
    }
  }
  if (!worst) return false;

  const bestOpponentCapture = captures.find((c) => c.to === worst!.to && (PIECE_VALUES[c.captured!] ?? 0) === worst!.capturedValue)!;
  const after = new Chess(fenAfter);
  after.move({ from: bestOpponentCapture.from, to: bestOpponentCapture.to, promotion: bestOpponentCapture.promotion });
  const recaptures = after.moves({ verbose: true }).filter((m) => m.to === worst!.to && m.captured);
  return recaptures.length === 0;
}

function movedOwnKingWithoutCastling(fenBefore: string, moveSan: string, moveUci: string): boolean {
  if (moveSan.startsWith("O-O")) return false;
  const { from } = squaresOf(moveUci);
  return new Chess(fenBefore).get(from)?.type === "k";
}

function lostCastlingRights(fenBefore: string, fenAfter: string): boolean {
  const before = castlingRights(fenBefore);
  const after = castlingRights(fenAfter);
  return before !== "-" && after !== before;
}

export interface MistakeContext {
  fenBefore: string;
  fenAfter: string;
  moveSan: string;
  moveUci: string;
  bestMoveSan: string;
  bestMoveUci: string;
  beforeScore: EngineScore;
}

/**
 * Catégorisation déterministe (pas d'appel LLM) — appelée uniquement pour les coups classés
 * "mistake"/"blunder". Chaque règle est volontairement simple et basée sur des API chess.js
 * stables (get/moves/board), pas sur une détection tactique exhaustive : mieux vaut une
 * catégorie approximative mais fiable qu'une classification fine mais fragile.
 */
export function categorizeMistake(ctx: MistakeContext): WeaknessCategory {
  const hadMateAvailable = ctx.beforeScore.type === "mate" && ctx.beforeScore.value > 0;
  if (hadMateAvailable && ctx.moveSan !== ctx.bestMoveSan && !new Chess(ctx.fenAfter).isCheckmate()) {
    return "missed_mate";
  }

  if (moveHangsAPiece(ctx.fenAfter)) {
    return "hanging_piece";
  }

  if (movedOwnKingWithoutCastling(ctx.fenBefore, ctx.moveSan, ctx.moveUci) || lostCastlingRights(ctx.fenBefore, ctx.fenAfter)) {
    return "king_safety";
  }

  if (ctx.moveUci !== ctx.bestMoveUci && bestMoveLooksLikeMissedKnightTactic(ctx.fenBefore, ctx.bestMoveUci)) {
    return "missed_fork";
  }

  if (countNonPawnMaterial(ctx.fenBefore) <= 13) {
    return "endgame_technique";
  }

  return "other";
}
