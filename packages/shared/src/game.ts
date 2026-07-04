/**
 * Constantes et logique de terrain pour l'espace de jeu voxel partagé.
 * Ce fichier est importé tel quel côté client ET serveur : les fonctions sont
 * pures et la seed est figée, donc les deux côtés calculent toujours le même
 * terrain de base sans avoir besoin de se synchroniser.
 */

export const GAME_WORLD_SIZE_X = 48;
export const GAME_WORLD_SIZE_Z = 48;
export const GAME_WORLD_HEIGHT = 24;
export const GAME_WORLD_SEED = 20260703;

export const GAME_BLOCK_TYPES = ["grass", "dirt", "stone", "wood", "sand", "red", "blue", "yellow"] as const;
export type GameBlockType = (typeof GAME_BLOCK_TYPES)[number];

export function isGameBlockType(value: string): value is GameBlockType {
  return (GAME_BLOCK_TYPES as readonly string[]).includes(value);
}

/** Bornes pour une case de bloc (pose/casse) : coordonnées toujours entières (grille). */
export function isWithinGameWorldBounds(x: number, y: number, z: number): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    Number.isInteger(z) &&
    x >= 0 &&
    x < GAME_WORLD_SIZE_X &&
    y >= 0 &&
    y < GAME_WORLD_HEIGHT &&
    z >= 0 &&
    z < GAME_WORLD_SIZE_Z
  );
}

/** Bornes pour une position de joueur (déplacement) : coordonnées continues (physique), pas
 * nécessairement entières — ne pas réutiliser isWithinGameWorldBounds ici. */
export function isWithinGameWorldBoundsContinuous(x: number, y: number, z: number): boolean {
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    Number.isFinite(z) &&
    x >= 0 &&
    x < GAME_WORLD_SIZE_X &&
    y >= 0 &&
    y < GAME_WORLD_HEIGHT &&
    z >= 0 &&
    z < GAME_WORLD_SIZE_Z
  );
}

const NOISE_LATTICE_SCALE = 10;

function hashLatticePoint(x: number, z: number): number {
  let h = GAME_WORLD_SEED;
  h = Math.imul(h ^ x, 374761393);
  h = Math.imul(h ^ z, 668265263);
  h ^= h >>> 13;
  h = Math.imul(h, 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 0xffffffff;
}

function valueNoiseAt(x: number, z: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const sx = x - x0;
  const sz = z - z0;
  const n00 = hashLatticePoint(x0, z0);
  const n10 = hashLatticePoint(x0 + 1, z0);
  const n01 = hashLatticePoint(x0, z0 + 1);
  const n11 = hashLatticePoint(x0 + 1, z0 + 1);
  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sz;
}

/** Hauteur (0..GAME_WORLD_HEIGHT-1) du terrain de base à une case (x,z) donnée. */
export function terrainHeightAt(x: number, z: number): number {
  const cx = GAME_WORLD_SIZE_X / 2;
  const cz = GAME_WORLD_SIZE_Z / 2;
  const dx = (x - cx) / cx;
  const dz = (z - cz) / cz;
  const distFromCenter = Math.sqrt(dx * dx + dz * dz);
  const islandFalloff = Math.max(0, 1 - distFromCenter * distFromCenter);

  const noise = valueNoiseAt(x / NOISE_LATTICE_SCALE, z / NOISE_LATTICE_SCALE);
  const rawHeight = 6 + noise * 6;
  const height = Math.round(rawHeight * islandFalloff);
  return Math.max(0, Math.min(GAME_WORLD_HEIGHT - 1, height));
}

/** Bloc de terrain de base (avant application des deltas joueurs) à une case donnée, ou null pour l'air. */
export function baseTerrainBlockAt(x: number, y: number, z: number): GameBlockType | null {
  const height = terrainHeightAt(x, z);
  if (y > height) return null;
  if (height <= 1) {
    return y === height ? "sand" : "stone";
  }
  if (y === height) return "grass";
  if (y >= height - 2) return "dirt";
  return "stone";
}
