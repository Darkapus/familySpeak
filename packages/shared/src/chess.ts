/**
 * Constantes et logique pures pour le module échecs (niveau moteur, qualité de coup,
 * catégories de faiblesse). Importé tel quel côté client ET serveur, comme game.ts.
 */

export const CHESS_ENGINE_SKILL_MIN = 1;
export const CHESS_ENGINE_SKILL_MAX = 8;

export const WEAKNESS_CATEGORIES = [
  "hanging_piece",
  "missed_fork",
  "king_safety",
  "missed_mate",
  "endgame_technique",
  "other",
] as const;
export type WeaknessCategory = (typeof WEAKNESS_CATEGORIES)[number];

export const MOVE_QUALITIES = ["best", "good", "inaccuracy", "mistake", "blunder"] as const;
export type MoveQuality = (typeof MOVE_QUALITIES)[number];

/**
 * Seuils façon lichess appliqués à la perte de centipions (centipawn loss) d'un coup par
 * rapport au meilleur coup du moteur. Les scores de mat sont normalisés en équivalents
 * centipions (voir normalizeEngineScore côté backend) avant d'appeler cette fonction : un seul
 * jeu de seuils gère donc les deux cas.
 */
export function classifyMoveQuality(centipawnLoss: number): MoveQuality {
  if (centipawnLoss < 10) return "best";
  if (centipawnLoss < 50) return "good";
  if (centipawnLoss < 100) return "inaccuracy";
  if (centipawnLoss < 300) return "mistake";
  return "blunder";
}

export const CHESS_WEAKNESS_LABELS: Record<WeaknessCategory, string> = {
  hanging_piece: "Pièces laissées en prise",
  missed_fork: "Fourchettes manquées",
  king_safety: "Sécurité du roi",
  missed_mate: "Mats manqués",
  endgame_technique: "Technique de finale",
  other: "Autres erreurs",
};
