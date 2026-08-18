import { useState } from "react";
import type { ChessProgressPointDTO } from "@familyspeak/shared";

interface ProgressChartProps {
  points: ChessProgressPointDTO[];
}

const CHART_WIDTH = 320;
const CHART_HEIGHT = 140;
const PADDING_X = 8;
const PADDING_BOTTOM = 8;
const PADDING_TOP = 12;
const BAR_COLOR = "#10b981"; // emerald-500, cohérent avec le reste de l'appli

function trendSummary(points: ChessProgressPointDTO[]): string | null {
  if (points.length < 4) return null;
  const mid = Math.floor(points.length / 2);
  const firstHalfAvg = points.slice(0, mid).reduce((s, p) => s + p.avgCentipawnLoss, 0) / mid;
  const secondHalfAvg = points.slice(mid).reduce((s, p) => s + p.avgCentipawnLoss, 0) / (points.length - mid);
  const delta = firstHalfAvg - secondHalfAvg;
  if (Math.abs(delta) < firstHalfAvg * 0.1) return "Niveau stable sur ces parties.";
  return delta > 0
    ? "Ça s'améliore : moins d'erreurs sur les parties récentes que sur les plus anciennes."
    : "Plus d'erreurs sur les parties récentes que sur les plus anciennes — normal si l'adversaire était plus fort.";
}

/** Perte moyenne de centipions par partie, dans l'ordre chronologique : la vraie visualisation
 * de progression (par opposition au profil de faiblesses, qui n'est qu'un instantané cumulé).
 * Plus la barre est basse, moins l'enfant a fait d'erreurs sur cette partie. */
export function ProgressChart({ points }: ProgressChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (points.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Pas encore de partie analysée pour tracer une progression.</p>;
  }

  const maxLoss = Math.max(...points.map((p) => p.avgCentipawnLoss), 50);
  const plotWidth = CHART_WIDTH - PADDING_X * 2;
  const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const barGap = 4;
  const barWidth = points.length > 0 ? plotWidth / points.length - barGap : 0;
  const summary = trendSummary(points);

  return (
    <div className="p-4">
      <p className="mb-2 text-sm font-semibold text-slate-600">Perte moyenne par partie (plus bas = mieux)</p>
      <div className="relative">
        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="w-full" role="img" aria-label="Progression dans le temps">
          <line
            x1={PADDING_X}
            y1={CHART_HEIGHT - PADDING_BOTTOM}
            x2={CHART_WIDTH - PADDING_X}
            y2={CHART_HEIGHT - PADDING_BOTTOM}
            stroke="#e2e8f0"
            strokeWidth={1}
          />
          {points.map((point, i) => {
            const height = Math.max(3, (point.avgCentipawnLoss / maxLoss) * plotHeight);
            const x = PADDING_X + i * (barWidth + barGap);
            const y = CHART_HEIGHT - PADDING_BOTTOM - height;
            return (
              <rect
                key={point.gameId}
                x={x}
                y={y}
                width={Math.max(2, barWidth)}
                height={height}
                rx={3}
                fill={BAR_COLOR}
                opacity={hovered === null || hovered === i ? 1 : 0.4}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onTouchStart={() => setHovered(i)}
              />
            );
          })}
        </svg>
        {hovered !== null && points[hovered] && (
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full rounded-lg bg-slate-800 px-2 py-1 text-xs text-white shadow">
            Partie {hovered + 1} · {points[hovered].avgCentipawnLoss} cp · {points[hovered].mistakeCount} erreur(s)
          </div>
        )}
      </div>
      {summary && <p className="mt-2 text-sm text-slate-500">{summary}</p>}
    </div>
  );
}
