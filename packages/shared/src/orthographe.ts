/** Jeu d'orthographe (accords) : catégories partagées client/serveur + DTO des statistiques. */

export const ORTHO_CATEGORIES = ["pluriel", "feminin", "verbe", "homophone", "participe"] as const;
export type OrthoCategory = (typeof ORTHO_CATEGORIES)[number];

export const ORTHO_CATEGORY_LABELS: Record<OrthoCategory, string> = {
  pluriel: "Le pluriel (s / x)",
  feminin: "Le féminin (e)",
  verbe: "Verbes : -e / -es / -ent",
  homophone: "a/à, est/et, sont/son, ont/on",
  participe: "Participe passé (être / avoir)",
};

export function isOrthoCategory(value: unknown): value is OrthoCategory {
  return typeof value === "string" && (ORTHO_CATEGORIES as readonly string[]).includes(value);
}

export interface OrthoCategoryStatDTO {
  category: OrthoCategory;
  total: number;
  correct: number;
}

export interface OrthoStatsDTO {
  categories: OrthoCategoryStatDTO[];
  /** Exercices dont la dernière réponse était fausse : à repasser en priorité. */
  missedItemIds: string[];
  /** Nombre de jours (distincts) où l'enfant s'est entraîné sur les 14 derniers jours. */
  activeDaysLast14: number;
}
