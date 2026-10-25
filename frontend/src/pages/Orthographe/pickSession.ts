import type { OrthoCategory, OrthoStatsDTO } from "@familyspeak/shared";
import { ORTHO_EXERCISES, type OrthoExercise } from "./exercises.js";

export const SESSION_LENGTH = 10;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * Tire une série d'exercices en favorisant ce que l'enfant rate : les exercices dont la dernière
 * réponse était fausse et les catégories où son taux d'erreur est le plus haut passent plus souvent,
 * sans jamais exclure le reste (sinon il ne reverrait plus jamais ce qu'il maîtrise).
 */
export function pickSession(
  category: OrthoCategory | "mix",
  stats: OrthoStatsDTO | undefined,
  length = SESSION_LENGTH,
): OrthoExercise[] {
  const pool = ORTHO_EXERCISES.filter((e) => category === "mix" || e.category === category);
  const missed = new Set(stats?.missedItemIds ?? []);
  const errorRate = new Map<OrthoCategory, number>();
  for (const s of stats?.categories ?? []) {
    // Peu de données : on suppose un taux moyen plutôt que de conclure trop vite.
    errorRate.set(s.category, s.total < 5 ? 0.5 : 1 - s.correct / s.total);
  }

  const remaining = pool.map((exercise) => ({
    exercise,
    weight: 1 + (missed.has(exercise.id) ? 3 : 0) + 2 * (errorRate.get(exercise.category) ?? 0.5),
  }));

  const picked: OrthoExercise[] = [];
  while (picked.length < length && remaining.length > 0) {
    const total = remaining.reduce((sum, r) => sum + r.weight, 0);
    let roll = Math.random() * total;
    let index = remaining.findIndex((r) => (roll -= r.weight) < 0);
    if (index === -1) index = remaining.length - 1;
    picked.push(remaining.splice(index, 1)[0]!.exercise);
  }
  return picked;
}

export function shuffleOptions(exercise: OrthoExercise): string[] {
  return shuffle(exercise.options);
}
