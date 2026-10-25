import { desc, eq, gte, and } from "drizzle-orm";
import { db } from "../../db/client.js";
import { orthoAttempts } from "../../db/schema.js";
import { ORTHO_CATEGORIES } from "@familyspeak/shared";
import type { OrthoCategory, OrthoStatsDTO } from "@familyspeak/shared";

const DAY_MS = 24 * 60 * 60 * 1000;
// Fenêtre glissante : les stats reflètent le niveau récent de l'enfant, pas ses débuts.
const STATS_ATTEMPTS_WINDOW = 500;

export function recordAttempt(input: { userId: string; itemId: string; category: OrthoCategory; correct: boolean }) {
  db.insert(orthoAttempts)
    .values({ id: crypto.randomUUID(), ...input, createdAt: Date.now() })
    .run();
}

export function getStats(userId: string): OrthoStatsDTO {
  const recent = db
    .select()
    .from(orthoAttempts)
    .where(eq(orthoAttempts.userId, userId))
    .orderBy(desc(orthoAttempts.createdAt))
    .limit(STATS_ATTEMPTS_WINDOW)
    .all();

  const totals = new Map<OrthoCategory, { total: number; correct: number }>(
    ORTHO_CATEGORIES.map((c) => [c, { total: 0, correct: 0 }]),
  );
  const lastResultByItem = new Map<string, boolean>();
  for (const attempt of recent) {
    const entry = totals.get(attempt.category)!;
    entry.total += 1;
    if (attempt.correct) entry.correct += 1;
    // `recent` est trié du plus récent au plus ancien : la première occurrence est la dernière réponse.
    if (!lastResultByItem.has(attempt.itemId)) lastResultByItem.set(attempt.itemId, attempt.correct);
  }

  const since = Date.now() - 14 * DAY_MS;
  const lastTwoWeeks = db
    .select({ createdAt: orthoAttempts.createdAt })
    .from(orthoAttempts)
    .where(and(eq(orthoAttempts.userId, userId), gte(orthoAttempts.createdAt, since)))
    .all();
  const activeDays = new Set(lastTwoWeeks.map((a) => new Date(a.createdAt).toDateString()));

  return {
    categories: ORTHO_CATEGORIES.map((category) => ({ category, ...totals.get(category)! })),
    missedItemIds: [...lastResultByItem].filter(([, correct]) => !correct).map(([id]) => id),
    activeDaysLast14: activeDays.size,
  };
}
