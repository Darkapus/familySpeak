import { useQuery } from "@tanstack/react-query";
import { CHESS_WEAKNESS_LABELS } from "@familyspeak/shared";
import { fetchChessWeaknessProfile } from "../../../api/chess.js";

export function WeaknessProfilePanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["chess", "weakness-profile"],
    queryFn: () => fetchChessWeaknessProfile(),
  });
  const profile = data?.profile ?? [];

  if (isLoading) return <p className="p-4 text-sm text-slate-400">Chargement…</p>;
  if (profile.length === 0) {
    return <p className="p-4 text-sm text-slate-400">Pas encore assez de parties analysées pour dégager un profil.</p>;
  }

  const maxCount = Math.max(...profile.map((p) => p.occurrenceCount));

  return (
    <div className="flex flex-col gap-3 p-4">
      {profile.map((entry) => (
        <div key={entry.category}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-700">{CHESS_WEAKNESS_LABELS[entry.category]}</span>
            <span className="text-slate-400">{entry.occurrenceCount}×</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-orange-400"
              style={{ width: `${Math.max(6, (entry.occurrenceCount / maxCount) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
