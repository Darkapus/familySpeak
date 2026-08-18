import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Chess, type Square } from "chess.js";
import { CHESS_WEAKNESS_LABELS } from "@familyspeak/shared";
import { fetchChessPuzzles } from "../../../api/chess.js";
import { ChessBoard } from "./ChessBoard.js";

type Feedback = "correct" | "incorrect" | null;

function uciToSquares(uci: string): [Square, Square] {
  return [uci.slice(0, 2) as Square, uci.slice(2, 4) as Square];
}

export function PuzzleTrainer() {
  const { data, isLoading } = useQuery({ queryKey: ["chess", "puzzles"], queryFn: () => fetchChessPuzzles(10) });
  const puzzles = data?.puzzles ?? [];

  const [index, setIndex] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [solved, setSolved] = useState(0);

  const puzzle = puzzles[index] ?? null;

  // Instance chess.js dédiée à l'exercice courant, recréée à chaque changement de puzzle.
  const chess = useMemo(() => (puzzle ? new Chess(puzzle.fen) : null), [puzzle]);

  useEffect(() => {
    setSelectedSquare(null);
    setFeedback(null);
  }, [puzzle?.moveEvalId]);

  const arrows = useMemo((): Array<[Square, Square, string?]> => {
    if (feedback !== "incorrect" || !puzzle) return [];
    const [from, to] = uciToSquares(puzzle.bestMoveUci);
    return [[from, to, "rgb(16, 185, 129)"]];
  }, [feedback, puzzle]);

  if (isLoading) return <p className="p-4 text-sm text-slate-400">Chargement…</p>;
  if (puzzles.length === 0) {
    return (
      <p className="p-4 text-sm text-slate-400">
        Pas encore assez de coups analysés pour te proposer des exercices : joue et fais analyser quelques parties
        d'abord !
      </p>
    );
  }
  if (!puzzle || !chess) return null;

  function attemptMove(from: string, to: string) {
    if (feedback || !chess || !puzzle) return;
    let uci: string;
    try {
      const move = chess.move({ from, to, promotion: "q" });
      uci = `${move.from}${move.to}${move.promotion ?? ""}`;
    } catch {
      return;
    }
    if (uci === puzzle.bestMoveUci) {
      setFeedback("correct");
      setSolved((s) => s + 1);
    } else {
      chess.undo();
      setFeedback("incorrect");
    }
  }

  function handleSquareClick(square: string) {
    if (feedback || !chess || !puzzle) return;
    if (selectedSquare) {
      const from = selectedSquare;
      setSelectedSquare(null);
      if (from !== square) attemptMove(from, square);
      return;
    }
    const expectedColor = puzzle.sideToMove === "white" ? "w" : "b";
    const piece = chess.get(square as Square);
    if (piece && piece.color === expectedColor) setSelectedSquare(square);
  }

  function next() {
    setIndex((i) => (i + 1) % puzzles.length);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-600">
          Exercice {index + 1} / {puzzles.length}
        </span>
        <span className="text-slate-400">{solved} réussi(s)</span>
      </div>
      <p className="text-sm text-slate-500">
        C'est à toi de jouer — retrouve le meilleur coup ({CHESS_WEAKNESS_LABELS[puzzle.category]}).
      </p>
      <ChessBoard
        fen={chess.fen()}
        onSquareClick={handleSquareClick}
        selectedSquare={selectedSquare}
        boardOrientation={puzzle.sideToMove}
        arePiecesDraggable={false}
        arrows={arrows}
      />
      {feedback === "correct" && (
        <div className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          ✅ Bravo, c'était le meilleur coup !
        </div>
      )}
      {feedback === "incorrect" && (
        <div className="rounded-xl bg-orange-50 p-3 text-sm font-semibold text-orange-700">
          ❌ Il y avait mieux : {puzzle.bestMoveSan} (flèche verte).
        </div>
      )}
      {feedback && (
        <button
          onClick={next}
          className="min-h-11 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-600"
        >
          Exercice suivant →
        </button>
      )}
    </div>
  );
}
