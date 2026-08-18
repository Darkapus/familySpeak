import { useQuery } from "@tanstack/react-query";
import type { ChessAnalysisStatus } from "@familyspeak/shared";
import { fetchChessGames } from "../../../api/chess.js";

interface GameHistoryListProps {
  onSelect: (gameId: string) => void;
}

const STATUS_LABELS: Record<ChessAnalysisStatus, string> = {
  none: "Non analysée",
  queued: "En attente d'analyse",
  analyzing: "Analyse en cours…",
  done: "Analysée",
  failed: "Échec de l'analyse",
};

export function GameHistoryList({ onSelect }: GameHistoryListProps) {
  const { data, isLoading } = useQuery({ queryKey: ["chess", "games"], queryFn: () => fetchChessGames() });
  const games = data?.games ?? [];

  if (isLoading) return <p className="p-4 text-sm text-slate-400">Chargement…</p>;
  if (games.length === 0) return <p className="p-4 text-sm text-slate-400">Aucune partie pour l'instant.</p>;

  return (
    <ul className="divide-y divide-slate-100">
      {games.map((game) => (
        <li key={game.id}>
          <button
            onClick={() => onSelect(game.id)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-700">
                {game.playerColor === "white" ? "⚪" : "⚫"} vs {game.opponentName ?? "Adversaire inconnu"}
              </p>
              <p className="text-xs text-slate-400">
                {new Date(game.playedAt).toLocaleDateString("fr-FR")} · {game.result}
              </p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-slate-400">{STATUS_LABELS[game.analysisStatus]}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
