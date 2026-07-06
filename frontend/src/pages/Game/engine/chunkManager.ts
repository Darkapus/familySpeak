import * as THREE from "three";
import {
  CHUNK_SIZE,
  GAME_WORLD_SIZE_X,
  GAME_WORLD_SIZE_Z,
  RENDER_DISTANCE_CHUNKS,
  chunkIndexForCoord,
  wrapCoord,
  type GameBlockType,
} from "@familyspeak/shared";
import { fetchChunks } from "../../../api/game.js";
import { WorldGrid, buildTerrainMeshes, disposeTerrainMeshes } from "./scene.js";

const TOTAL_CHUNKS_X = GAME_WORLD_SIZE_X / CHUNK_SIZE;
const TOTAL_CHUNKS_Z = GAME_WORLD_SIZE_Z / CHUNK_SIZE;

interface LoadedChunk {
  grid: WorldGrid;
  meshesByType: Map<GameBlockType, THREE.Mesh>;
  group: THREE.Group;
}

function chunkKey(cx: number, cz: number): string {
  return `${cx}_${cz}`;
}

/** Parmi les 3 copies possibles (-taille/0/+taille) d'une origine de chunk dans un monde
 * torique, choisit celle la plus proche de la position du joueur. Comme le rayon de rendu est
 * très inférieur à la demi-taille du monde, ce choix n'est jamais ambigu — c'est ce qui rend le
 * passage d'un bord invisible : le chunk "de l'autre côté" du monde est dessiné juste à côté du
 * joueur plutôt qu'à sa position canonique, potentiellement lointaine. */
function nearestOffset(chunkOrigin: number, playerCoord: number, worldSize: number): number {
  let best = chunkOrigin - worldSize;
  let bestDist = Math.abs(best - playerCoord);
  for (const candidate of [chunkOrigin, chunkOrigin + worldSize]) {
    const dist = Math.abs(candidate - playerCoord);
    if (dist < bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Charge/décharge les chunks de terrain autour du joueur et les repositionne pour un rendu
 * torique sans coutures. Le monde (512×512) est bien trop grand pour tenir en mémoire d'un bloc :
 * seuls les chunks dans `RENDER_DISTANCE_CHUNKS` autour du joueur sont chargés à un instant donné.
 */
export class ChunkManager {
  private loaded = new Map<string, LoadedChunk>();
  private pendingFetch = new Set<string>();
  private pendingGrids = new Map<string, WorldGrid>();
  private buildQueue: string[] = [];
  private lastPlayerChunkX: number | null = null;
  private lastPlayerChunkZ: number | null = null;
  private lastPlayerX = 0;
  private lastPlayerZ = 0;

  constructor(private readonly scene: THREE.Scene) {}

  /** true dès que le chunk contenant (x,z) est chargé — pour fermer l'écran de chargement sans
   * attendre tout le rayon de vue. */
  isChunkLoadedAt(x: number, z: number): boolean {
    const cx = chunkIndexForCoord(x, GAME_WORLD_SIZE_X);
    const cz = chunkIndexForCoord(z, GAME_WORLD_SIZE_Z);
    return this.loaded.has(chunkKey(cx, cz));
  }

  isSolid(x: number, y: number, z: number): boolean {
    const wx = wrapCoord(x, GAME_WORLD_SIZE_X);
    const wz = wrapCoord(z, GAME_WORLD_SIZE_Z);
    const cx = chunkIndexForCoord(wx, GAME_WORLD_SIZE_X);
    const cz = chunkIndexForCoord(wz, GAME_WORLD_SIZE_Z);
    const chunk = this.loaded.get(chunkKey(cx, cz));
    if (!chunk) return false;
    return chunk.grid.isSolid(wx - chunk.grid.originX, y, wz - chunk.grid.originZ);
  }

  applyBlockChange(x: number, y: number, z: number, blockType: GameBlockType | null): void {
    const wx = wrapCoord(x, GAME_WORLD_SIZE_X);
    const wz = wrapCoord(z, GAME_WORLD_SIZE_Z);
    const cx = chunkIndexForCoord(wx, GAME_WORLD_SIZE_X);
    const cz = chunkIndexForCoord(wz, GAME_WORLD_SIZE_Z);
    const chunk = this.loaded.get(chunkKey(cx, cz));
    if (!chunk) return; // ce chunk aura la bonne donnée à son prochain chargement depuis la base
    chunk.grid.setBlock(wx - chunk.grid.originX, y, wz - chunk.grid.originZ, blockType);
    for (const mesh of chunk.meshesByType.values()) chunk.group.remove(mesh);
    disposeTerrainMeshes(chunk.meshesByType.values());
    chunk.meshesByType = buildTerrainMeshes(chunk.grid);
    for (const mesh of chunk.meshesByType.values()) chunk.group.add(mesh);
  }

  /** À appeler chaque frame. Ne fait un travail réel (recalcul des chunks voulus, requête
   * réseau) que lorsque le joueur change de chunk ; construit au plus un chunk en attente par
   * appel pour étaler le coût du maillage sur plusieurs frames plutôt qu'un à-coup. */
  update(playerX: number, playerZ: number): void {
    this.lastPlayerX = playerX;
    this.lastPlayerZ = playerZ;
    const playerChunkX = chunkIndexForCoord(playerX, GAME_WORLD_SIZE_X);
    const playerChunkZ = chunkIndexForCoord(playerZ, GAME_WORLD_SIZE_Z);

    if (playerChunkX !== this.lastPlayerChunkX || playerChunkZ !== this.lastPlayerChunkZ) {
      this.lastPlayerChunkX = playerChunkX;
      this.lastPlayerChunkZ = playerChunkZ;
      this.reconcileChunks(playerChunkX, playerChunkZ, playerX, playerZ);
    }

    this.drainBuildQueue();
  }

  private reconcileChunks(playerChunkX: number, playerChunkZ: number, playerX: number, playerZ: number): void {
    const needed = new Set<string>();
    for (let dx = -RENDER_DISTANCE_CHUNKS; dx <= RENDER_DISTANCE_CHUNKS; dx++) {
      for (let dz = -RENDER_DISTANCE_CHUNKS; dz <= RENDER_DISTANCE_CHUNKS; dz++) {
        const cx = wrapCoord(playerChunkX + dx, TOTAL_CHUNKS_X);
        const cz = wrapCoord(playerChunkZ + dz, TOTAL_CHUNKS_Z);
        needed.add(chunkKey(cx, cz));
      }
    }

    for (const [key, chunk] of this.loaded) {
      if (needed.has(key)) continue;
      this.scene.remove(chunk.group);
      disposeTerrainMeshes(chunk.meshesByType.values());
      this.loaded.delete(key);
    }
    this.buildQueue = this.buildQueue.filter((key) => needed.has(key));
    for (const key of [...this.pendingFetch]) {
      if (!needed.has(key)) this.pendingFetch.delete(key);
    }

    for (const chunk of this.loaded.values()) {
      chunk.group.position.set(
        nearestOffset(chunk.grid.originX, playerX, GAME_WORLD_SIZE_X) - chunk.grid.originX,
        0,
        nearestOffset(chunk.grid.originZ, playerZ, GAME_WORLD_SIZE_Z) - chunk.grid.originZ,
      );
    }

    const missing: { cx: number; cz: number; key: string }[] = [];
    for (const key of needed) {
      if (this.loaded.has(key) || this.pendingFetch.has(key)) continue;
      const [cxStr, czStr] = key.split("_");
      missing.push({ cx: Number(cxStr), cz: Number(czStr), key });
      this.pendingFetch.add(key);
    }
    if (missing.length > 0) this.fetchMissing(missing);
  }

  private async fetchMissing(missing: { cx: number; cz: number; key: string }[]): Promise<void> {
    const { chunks } = await fetchChunks(missing.map(({ cx, cz }) => ({ cx, cz })));
    for (const { cx, cz, key } of missing) {
      if (!this.pendingFetch.has(key)) continue; // le joueur s'est déjà trop éloigné entre-temps
      this.pendingFetch.delete(key);
      const grid = WorldGrid.fromDeltas(cx * CHUNK_SIZE, cz * CHUNK_SIZE, chunks[key] ?? []);
      this.pendingGrids.set(key, grid);
      this.buildQueue.push(key);
    }
  }

  private drainBuildQueue(): void {
    const key = this.buildQueue.shift();
    if (!key) return;
    const grid = this.pendingGrids.get(key);
    this.pendingGrids.delete(key);
    if (!grid) return;

    const meshesByType = buildTerrainMeshes(grid);
    const group = new THREE.Group();
    for (const mesh of meshesByType.values()) group.add(mesh);
    group.position.set(
      nearestOffset(grid.originX, this.lastPlayerX, GAME_WORLD_SIZE_X) - grid.originX,
      0,
      nearestOffset(grid.originZ, this.lastPlayerZ, GAME_WORLD_SIZE_Z) - grid.originZ,
    );
    this.scene.add(group);
    this.loaded.set(key, { grid, meshesByType, group });
  }

  dispose(): void {
    for (const chunk of this.loaded.values()) {
      this.scene.remove(chunk.group);
      disposeTerrainMeshes(chunk.meshesByType.values());
    }
    this.loaded.clear();
    this.buildQueue = [];
    this.pendingFetch.clear();
    this.pendingGrids.clear();
  }
}
