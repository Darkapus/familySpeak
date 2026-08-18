import type { ChessProgressPointDTO } from "@familyspeak/shared";

interface RatingProgressProps {
  points: ChessProgressPointDTO[];
}

const SPARKLINE_WIDTH = 280;
const SPARKLINE_HEIGHT = 48;
const SPARKLINE_PADDING = 4;

/** Le classement Elo chess.com réel de l'enfant au fil des parties importées, plutôt qu'une
 * métrique interne (perte de centipions) peu parlante pour un enfant/parent. Les parties live
 * contre le moteur n'ont pas d'équivalent comparable et sont ignorées ici. */
export function RatingProgress({ points }: RatingProgressProps) {
  const rated = points.filter(
    (p): p is ChessProgressPointDTO & { playerElo: number } => p.playerElo !== null,
  );

  if (rated.length === 0) {
    return (
      <p className="p-4 text-sm text-slate-400">
        Pas encore de classement chess.com disponible — importe des parties pour voir le niveau progresser.
      </p>
    );
  }

  const latest = rated[rated.length - 1]!.playerElo;
  const first = rated[0]!.playerElo;
  const delta = latest - first;

  const min = Math.min(...rated.map((r) => r.playerElo));
  const max = Math.max(...rated.map((r) => r.playerElo));
  const range = Math.max(1, max - min);
  const innerWidth = SPARKLINE_WIDTH - SPARKLINE_PADDING * 2;
  const innerHeight = SPARKLINE_HEIGHT - SPARKLINE_PADDING * 2;
  const sparklinePoints = rated
    .map((r, i) => {
      const x = SPARKLINE_PADDING + (rated.length > 1 ? (i / (rated.length - 1)) * innerWidth : innerWidth / 2);
      const y = SPARKLINE_PADDING + innerHeight - ((r.playerElo - min) / range) * innerHeight;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="p-4">
      <p className="text-sm font-semibold text-slate-600">Ton classement chess.com</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-4xl font-extrabold text-slate-800">{latest}</span>
        {rated.length > 1 && delta !== 0 && (
          <span className={`text-sm font-bold ${delta > 0 ? "text-emerald-600" : "text-slate-500"}`}>
            {delta > 0 ? "+" : ""}
            {delta} depuis le début du suivi
          </span>
        )}
      </div>
      {rated.length >= 2 && (
        <svg viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`} className="mt-3 w-full max-w-xs" role="img" aria-label="Évolution du classement">
          <polyline
            points={sparklinePoints}
            fill="none"
            stroke="#10b981"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}
