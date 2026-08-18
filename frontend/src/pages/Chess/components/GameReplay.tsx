import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Chess, type Square } from "chess.js";
import { CHESS_WEAKNESS_LABELS } from "@familyspeak/shared";
import type { MoveQuality } from "@familyspeak/shared";
import { fetchChessGame, fetchChessGameAnalysis, reanalyzeChessGame } from "../../../api/chess.js";
import { ChessBoard } from "./ChessBoard.js";

interface GameReplayProps {
  gameId: string;
  onBack: () => void;
}

const QUALITY_COLORS: Record<MoveQuality, string> = {
  best: "text-emerald-600",
  good: "text-emerald-500",
  inaccuracy: "text-amber-500",
  mistake: "text-orange-500",
  blunder: "text-red-500",
};

const QUALITY_LABELS: Record<MoveQuality, string> = {
  best: "Meilleur coup",
  good: "Bon coup",
  inaccuracy: "Imprécision",
  mistake: "Erreur",
  blunder: "Gaffe",
};

const BEST_MOVE_ARROW_COLOR = "rgb(16, 185, 129)";
const PLAYED_MOVE_ARROW_COLOR = "rgb(239, 68, 68)";

function uciToSquares(uci: string): [Square, Square] {
  return [uci.slice(0, 2) as Square, uci.slice(2, 4) as Square];
}

export function GameReplay({ gameId, onBack }: GameReplayProps) {
  const queryClient = useQueryClient();
  const gameQuery = useQuery({ queryKey: ["chess", "game", gameId], queryFn: () => fetchChessGame(gameId) });
  const analysisQuery = useQuery({
    queryKey: ["chess", "analysis", gameId],
    queryFn: () => fetchChessGameAnalysis(gameId),
    refetchInterval: (query) => (query.state.data && query.state.data.moves.length > 0 ? false : 3000),
  });
  const reanalyzeMutation = useMutation({
    mutationFn: () => reanalyzeChessGame(gameId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["chess", "game", gameId] }),
  });

  const moves = analysisQuery.data?.moves ?? [];
  const [index, setIndex] = useState(-1); // -1 = position de départ ; sinon index = dernier coup appliqué
  const currentMove = index >= 0 ? moves[index] : null;
  const game = gameQuery.data?.game;

  // Le plateau doit refléter le coup qu'on est en train de commenter (sinon on affiche "b4 —
  // Imprécision" alors que rien n'a bougé sur l'échiquier). moves[i+1].fenBefore est exactement
  // le fenAfter du coup i (le même historique continu) — gratuit, pas besoin de le stocker en
  // base. Seul le tout dernier coup n'a pas de "coup suivant" pour nous le donner : on le calcule
  // nous-mêmes avec chess.js.
  const fen = useMemo(() => {
    if (index < 0) return "start";
    if (index < moves.length - 1) return moves[index + 1]!.fenBefore;
    const move = moves[index];
    if (!move) return "start";
    try {
      const chess = new Chess(move.fenBefore);
      chess.move(move.moveSan);
      return chess.fen();
    } catch {
      return move.fenBefore;
    }
  }, [index, moves]);

  const arrows = useMemo((): Array<[Square, Square, string?]> => {
    if (!currentMove || currentMove.quality === "best") return [];
    const arrowList: Array<[Square, Square, string?]> = [];
    const [bestFrom, bestTo] = uciToSquares(currentMove.bestMoveUci);
    arrowList.push([bestFrom, bestTo, BEST_MOVE_ARROW_COLOR]);
    if (currentMove.moveUci !== currentMove.bestMoveUci) {
      const [playedFrom, playedTo] = uciToSquares(currentMove.moveUci);
      arrowList.push([playedFrom, playedTo, PLAYED_MOVE_ARROW_COLOR]);
    }
    return arrowList;
  }, [currentMove]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-4 py-3">
        <button onClick={onBack} className="text-sm font-semibold text-slate-500 hover:text-slate-700">
          ← Retour
        </button>
        <p className="truncate text-sm font-semibold text-slate-700">vs {game?.opponentName ?? "…"}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <ChessBoard fen={fen} boardOrientation={game?.playerColor ?? "white"} arePiecesDraggable={false} arrows={arrows} />
        {moves.length === 0 && game?.analysisStatus === "failed" && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <p className="text-sm text-slate-400">L'analyse a échoué.</p>
            <button
              onClick={() => reanalyzeMutation.mutate()}
              disabled={reanalyzeMutation.isPending}
              className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200"
            >
              Relancer l'analyse
            </button>
          </div>
        )}
        {moves.length === 0 && game?.analysisStatus !== "failed" && (
          <p className="mt-4 text-center text-sm text-slate-400">Analyse en cours…</p>
        )}
        {currentMove && (
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
            <p className={`font-bold ${QUALITY_COLORS[currentMove.quality]}`}>
              {currentMove.moveSan} — {QUALITY_LABELS[currentMove.quality]}
            </p>
            {currentMove.mistakeCategory && (
              <p className="text-slate-500">Catégorie : {CHESS_WEAKNESS_LABELS[currentMove.mistakeCategory]}</p>
            )}
            {currentMove.moveSan !== currentMove.bestMoveSan && (
              <p className="text-slate-500">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: BEST_MOVE_ARROW_COLOR }} />{" "}
                Meilleur coup : {currentMove.bestMoveSan}
              </p>
            )}
          </div>
        )}
      </div>
      {moves.length > 0 && (
        <div className="flex shrink-0 items-center justify-center gap-3 border-t border-slate-100 px-4 py-3">
          <button
            onClick={() => setIndex((i) => Math.max(-1, i - 1))}
            disabled={index <= -1}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold disabled:opacity-40"
          >
            ←
          </button>
          <span className="text-xs text-slate-400">
            {index + 1} / {moves.length}
          </span>
          <button
            onClick={() => setIndex((i) => Math.min(moves.length - 1, i + 1))}
            disabled={index >= moves.length - 1}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
