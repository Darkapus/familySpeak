import * as THREE from "three";
import {
  GAME_BLOCK_TYPES,
  GAME_WORLD_HEIGHT,
  GAME_WORLD_SIZE_X,
  GAME_WORLD_SIZE_Z,
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

/** Grille dense en mémoire des blocs solides du monde (terrain de base + deltas appliqués). */
export class WorldGrid {
  private cells = new Uint8Array(GAME_WORLD_SIZE_X * GAME_WORLD_HEIGHT * GAME_WORLD_SIZE_Z);

  static index(x: number, y: number, z: number): number {
    return x + z * GAME_WORLD_SIZE_X + y * GAME_WORLD_SIZE_X * GAME_WORLD_SIZE_Z;
  }

  static inBounds(x: number, y: number, z: number): boolean {
    return (
      x >= 0 && x < GAME_WORLD_SIZE_X && y >= 0 && y < GAME_WORLD_HEIGHT && z >= 0 && z < GAME_WORLD_SIZE_Z
    );
  }

  getBlockType(x: number, y: number, z: number): GameBlockType | null {
    if (!WorldGrid.inBounds(x, y, z)) return null;
    return ID_TO_BLOCK_TYPE[this.cells[WorldGrid.index(x, y, z)]!] ?? null;
  }

  isSolid(x: number, y: number, z: number): boolean {
    if (!WorldGrid.inBounds(x, y, z)) return false;
    return this.cells[WorldGrid.index(x, y, z)] !== AIR;
  }

  setBlock(x: number, y: number, z: number, blockType: GameBlockType | null): void {
    if (!WorldGrid.inBounds(x, y, z)) return;
    this.cells[WorldGrid.index(x, y, z)] = blockType ? BLOCK_TYPE_IDS[blockType] : AIR;
  }

  private fillFromTerrain(): void {
    for (let x = 0; x < GAME_WORLD_SIZE_X; x++) {
      for (let z = 0; z < GAME_WORLD_SIZE_Z; z++) {
        for (let y = 0; y < GAME_WORLD_HEIGHT; y++) {
          const type = baseTerrainBlockAt(x, y, z);
          if (type) this.cells[WorldGrid.index(x, y, z)] = BLOCK_TYPE_IDS[type];
        }
      }
    }
  }

  static fromDeltas(deltas: WorldBlockDTO[]): WorldGrid {
    const grid = new WorldGrid();
    grid.fillFromTerrain();
    for (const delta of deltas) grid.setBlock(delta.x, delta.y, delta.z, delta.blockType);
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

/** Construit un mesh fusionné par type de bloc, en ne générant que les faces exposées à l'air. */
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

  for (let x = 0; x < GAME_WORLD_SIZE_X; x++) {
    for (let y = 0; y < GAME_WORLD_HEIGHT; y++) {
      for (let z = 0; z < GAME_WORLD_SIZE_Z; z++) {
        const type = grid.getBlockType(x, y, z);
        if (!type) continue;
        const buffer = bufferFor(type);
        for (const face of FACES) {
          const [dx, dy, dz] = face.dir;
          if (grid.isSolid(x + dx, y + dy, z + dz)) continue;
          const startIndex = buffer.positions.length / 3;
          for (const [cx, cy, cz] of face.corners) {
            buffer.positions.push(x + cx, y + cy, z + cz);
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
    const material = new THREE.MeshLambertMaterial({ color: BLOCK_COLORS[type] });
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
