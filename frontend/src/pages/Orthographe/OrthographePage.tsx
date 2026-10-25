import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ORTHO_CATEGORIES, ORTHO_CATEGORY_LABELS } from "@familyspeak/shared";
import type { OrthoCategory } from "@familyspeak/shared";
import { fetchOrthoStats } from "../../api/orthographe.js";
import { listUsers } from "../../api/users.js";
import { useAuthStore } from "../../store/auth.js";
import { OrthographeSession } from "./OrthographeSession.js";
import { pickSession } from "./pickSession.js";
import type { OrthoExercise } from "./exercises.js";

function CategoryBar({ label, total, correct }: { label: string; total: number; correct: number }) {
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  const color = percent >= 80 ? "bg-emerald-500" : percent >= 50 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span className="font-semibold">{total === 0 ? "—" : `${percent}%`}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

interface SessionState {
  key: number;
  exercises: OrthoExercise[];
  category: OrthoCategory | "mix";
}

export function OrthographePage() {
  const user = useAuthStore((state) => state.user);
  const isParent = user?.role === "parent";
  const [viewedUserId, setViewedUserId] = useState<string | undefined>(undefined);
  const [session, setSession] = useState<SessionState | null>(null);

  const ownStats = useQuery({ queryKey: ["orthographe", "stats", "me"], queryFn: () => fetchOrthoStats() });
  const viewedStats = useQuery({
    queryKey: ["orthographe", "stats", viewedUserId],
    queryFn: () => fetchOrthoStats(viewedUserId),
    enabled: viewedUserId !== undefined,
  });
  const family = useQuery({ queryKey: ["users"], queryFn: listUsers, enabled: isParent });

  const shownStats = viewedUserId ? viewedStats.data : ownStats.data;

  function start(category: OrthoCategory | "mix") {
    setSession({ key: Date.now(), exercises: pickSession(category, ownStats.data), category });
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-white">
      <header className="flex shrink-0 items-center gap-3 bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3">
        <Link to="/" className="text-sm font-semibold text-white/80 hover:text-white">
          ← Retour
        </Link>
        <h1 className="text-sm font-bold text-white">✏️ Orthographe</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {session ? (
          <OrthographeSession
            key={session.key}
            exercises={session.exercises}
            onExit={() => setSession(null)}
            onReplay={() => start(session.category)}
          />
        ) : (
          <div className="flex flex-col gap-5 p-4">
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">Les accords, c'est parti !</h2>
              <p className="text-sm text-slate-500">
                10 phrases à compléter. Le jeu insiste sur ce que tu rates le plus.
              </p>
            </div>

            <button
              onClick={() => start("mix")}
              className="min-h-14 rounded-2xl bg-emerald-500 px-4 text-base font-extrabold text-white shadow hover:bg-emerald-600"
            >
              🎯 Entraînement mixte
            </button>

            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Ou choisis un thème</h3>
              {ORTHO_CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => start(category)}
                  className="min-h-11 rounded-xl border border-slate-200 px-4 text-left text-sm font-semibold text-slate-700 hover:border-emerald-400"
                >
                  {ORTHO_CATEGORY_LABELS[category]}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-700">📊 Progrès</h3>
                {isParent && (
                  <select
                    value={viewedUserId ?? ""}
                    onChange={(e) => setViewedUserId(e.target.value || undefined)}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                    aria-label="Voir les progrès de"
                  >
                    <option value="">Moi</option>
                    {family.data?.users
                      .filter((u) => u.id !== user?.id)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.displayName}
                        </option>
                      ))}
                  </select>
                )}
              </div>
              {shownStats ? (
                <>
                  {shownStats.categories.map((s) => (
                    <CategoryBar
                      key={s.category}
                      label={ORTHO_CATEGORY_LABELS[s.category]}
                      total={s.total}
                      correct={s.correct}
                    />
                  ))}
                  <p className="text-xs text-slate-400">
                    Entraînement sur {shownStats.activeDaysLast14} jour{shownStats.activeDaysLast14 > 1 ? "s" : ""} ces 14
                    derniers jours. Objectif : un peu chaque jour 🙂
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-400">Chargement…</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
