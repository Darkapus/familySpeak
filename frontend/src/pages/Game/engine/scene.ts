import * as THREE from "three";
import {
  CHUNK_SIZE,
  GAME_BLOCK_TYPES,
  GAME_WORLD_HEIGHT,
  baseTerrainBlockAt,
  type GameBlockType,
  type WorldBlockDTO,
} from "@familyspeak/shared";

const AIR = 0;
const BLOCK_TYPE_IDS = Object.fromEntries(GAME_BLOCK_TYPES.map((type, i) => [type, i + 1])) as Record<
  GameBlockType,
  number
>;
const ID_TO_BLOCK_TYPE: (GameBlockType | null)[] = [null, ...GAME_BLOCK_TYPES];

/**
 * Grille dense en mémoire d'un seul chunk (CHUNK_SIZE × GAME_WORLD_HEIGHT × CHUNK_SIZE), indexée
 * en coordonnées locales 0..CHUNK_SIZE-1. `originX`/`originZ` situent ce chunk dans l'espace
 * monde canonique — utilisés pour générer son terrain de base et positionner son mesh, jamais
 * pour l'indexation interne. Les faces au bord d'un chunk ne sont pas fusionnées avec le chunk
 * voisin (chaque chunk se maille indépendamment) : simplification acceptée, sans impact
 * fonctionnel, juste quelques faces superflues invisibles à la jointure.
 */
export class WorldGrid {
  private cells = new Uint8Array(CHUNK_SIZE * GAME_WORLD_HEIGHT * CHUNK_SIZE);

  constructor(
    public readonly originX: number,
    public readonly originZ: number,
  ) {}

  private static index(lx: number, y: number, lz: number): number {
    return lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
  }

  private static inBounds(lx: number, y: number, lz: number): boolean {
    return lx >= 0 && lx < CHUNK_SIZE && y >= 0 && y < GAME_WORLD_HEIGHT && lz >= 0 && lz < CHUNK_SIZE;
  }

  getBlockType(lx: number, y: number, lz: number): GameBlockType | null {
    if (!WorldGrid.inBounds(lx, y, lz)) return null;
    return ID_TO_BLOCK_TYPE[this.cells[WorldGrid.index(lx, y, lz)]!] ?? null;
  }

  /** L'eau n'est pas solide (comme l'air) : pas de mécanique de nage, un joueur qui y entre
   * traverse jusqu'au fond, et les faces de blocs voisins de l'eau restent rendues (transparence). */
  isSolid(lx: number, y: number, lz: number): boolean {
    if (!WorldGrid.inBounds(lx, y, lz)) return false;
    const id = this.cells[WorldGrid.index(lx, y, lz)]!;
    return id !== AIR && ID_TO_BLOCK_TYPE[id] !== "water";
  }

  setBlock(lx: number, y: number, lz: number, blockType: GameBlockType | null): void {
    if (!WorldGrid.inBounds(lx, y, lz)) return;
    this.cells[WorldGrid.index(lx, y, lz)] = blockType ? BLOCK_TYPE_IDS[blockType] : AIR;
  }

  private fillFromTerrain(): void {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let y = 0; y < GAME_WORLD_HEIGHT; y++) {
          const type = baseTerrainBlockAt(this.originX + lx, y, this.originZ + lz);
          if (type) this.cells[WorldGrid.index(lx, y, lz)] = BLOCK_TYPE_IDS[type];
        }
      }
    }
  }

  /** Construit la grille d'un chunk à partir de son origine monde ; `deltas` doit déjà être
   * filtré pour ce chunk (c'est ce que renvoie l'API `/game/chunks`). */
  static fromDeltas(originX: number, originZ: number, deltas: WorldBlockDTO[]): WorldGrid {
    const grid = new WorldGrid(originX, originZ);
    grid.fillFromTerrain();
    for (const delta of deltas) {
      grid.setBlock(delta.x - originX, delta.y, delta.z - originZ, delta.blockType);
    }
    return grid;
  }
}

export const BLOCK_COLORS: Record<GameBlockType, number> = {
  grass: 0x5cb85c,
  dirt: 0x8b5a2b,
  stone: 0x9e9e9e,
  wood: 0xa1887f,
  sand: 0xe4d7a0,
  red: 0xe53935,
  blue: 0x1e88e5,
  yellow: 0xfdd835,
  water: 0x2f6fb8,
};

const FACES = [
  { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { dir: [0, 1, 0], corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { dir: [0, -1, 0], corners: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]] },
  { dir: [0, 0, 1], corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { dir: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
] as const;

interface FaceBuffer {
  positions: number[];
  normals: number[];
  indices: number[];
}

/** Construit un mesh fusionné par type de bloc pour un chunk, en coordonnées monde canoniques
 * (`grid.originX/originZ` + décalage local). Le décalage d'enroulement pour le rendu torique
 * (voir `chunkManager.ts`) est appliqué séparément, sur le groupe qui contient ces meshes — pas
 * ici, pour ne jamais avoir à reconstruire la géométrie quand seule la position visuelle change. */
export function buildTerrainMeshes(grid: WorldGrid): Map<GameBlockType, THREE.Mesh> {
  const buffers = new Map<GameBlockType, FaceBuffer>();

  function bufferFor(type: GameBlockType): FaceBuffer {
    let buffer = buffers.get(type);
    if (!buffer) {
      buffer = { positions: [], normals: [], indices: [] };
      buffers.set(type, buffer);
    }
    return buffer;
  }

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let y = 0; y < GAME_WORLD_HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const type = grid.getBlockType(lx, y, lz);
        if (!type) continue;
        const buffer = bufferFor(type);
        for (const face of FACES) {
          const [dx, dy, dz] = face.dir;
          // Cas particulier de l'eau : culler seulement les faces internes à un même bassin
          // (voisin aussi eau), sinon chaque interface eau-eau dessine un quad transparent
          // superflu (surcoût + artefacts de tri de transparence à l'intérieur d'un lac).
          if (type === "water") {
            if (grid.getBlockType(lx + dx, y + dy, lz + dz) === "water") continue;
          } else if (grid.isSolid(lx + dx, y + dy, lz + dz)) {
            continue;
          }
          const startIndex = buffer.positions.length / 3;
          for (const [cx, cy, cz] of face.corners) {
            buffer.positions.push(grid.originX + lx + cx, y + cy, grid.originZ + lz + cz);
            buffer.normals.push(dx, dy, dz);
          }
          buffer.indices.push(startIndex, startIndex + 1, startIndex + 2, startIndex, startIndex + 2, startIndex + 3);
        }
      }
    }
  }

  const meshes = new Map<GameBlockType, THREE.Mesh>();
  for (const [type, buffer] of buffers) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(buffer.positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(buffer.normals, 3));
    geometry.setIndex(buffer.indices);
    const material =
      type === "water"
        ? new THREE.MeshLambertMaterial({ color: BLOCK_COLORS[type], transparent: true, opacity: 0.75 })
        : new THREE.MeshLambertMaterial({ color: BLOCK_COLORS[type] });
    meshes.set(type, new THREE.Mesh(geometry, material));
  }
  return meshes;
}

export function disposeTerrainMeshes(meshes: Iterable<THREE.Mesh>): void {
  for (const mesh of meshes) {
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
}
