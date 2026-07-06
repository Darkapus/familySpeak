import { GAME_WORLD_SIZE_X, GAME_WORLD_SIZE_Z, terrainHeightAt, type GamePlayerStateDTO } from "@familyspeak/shared";
import { broadcastToUsers } from "../../ws/registry.js";
import { listUsers } from "../users/repository.js";

const MOVE_FLUSH_INTERVAL_MS = 100;
const DEFAULT_SPAWN_X = GAME_WORLD_SIZE_X / 2;
const DEFAULT_SPAWN_Z = GAME_WORLD_SIZE_Z / 2;
const DEFAULT_SPAWN_POSITION = {
  x: DEFAULT_SPAWN_X,
  y: terrainHeightAt(DEFAULT_SPAWN_X, DEFAULT_SPAWN_Z) + 1,
  z: DEFAULT_SPAWN_Z,
  yaw: 0,
  pitch: 0,
};

const livePlayers = new Map<string, GamePlayerStateDTO>();
const pendingMoves = new Map<string, GamePlayerStateDTO>();
let flushLoopStarted = false;

/** Fait entrer un joueur dans le jeu (à son repère personnel s'il en a défini un, sinon au spawn
 * par défaut) ; renvoie son propre état et celui des autres joueurs déjà présents. */
export function playerJoin(
  userId: string,
  displayName: string,
  home?: { x: number; y: number; z: number; yaw: number; pitch: number },
): { self: GamePlayerStateDTO; others: GamePlayerStateDTO[] } {
  const others = Array.from(livePlayers.values());
  const self: GamePlayerStateDTO = { userId, displayName, ...(home ?? DEFAULT_SPAWN_POSITION) };
  livePlayers.set(userId, self);
  return { self, others };
}

/** Retire un joueur du jeu. Renvoie true s'il y était effectivement (pour éviter une diffusion inutile). */
export function playerLeave(userId: string): boolean {
  pendingMoves.delete(userId);
  return livePlayers.delete(userId);
}

export function queueMove(userId: string, move: Omit<GamePlayerStateDTO, "userId" | "displayName">): void {
  const player = livePlayers.get(userId);
  if (!player) return;
  const updated: GamePlayerStateDTO = { ...player, ...move };
  livePlayers.set(userId, updated);
  pendingMoves.set(userId, updated);
}

function flushMoves(): void {
  if (pendingMoves.size === 0) return;
  const allIds = listUsers().map((u) => u.id);
  for (const [userId, state] of pendingMoves) {
    broadcastToUsers(
      allIds.filter((id) => id !== userId),
      {
        type: "game:player-moved",
        payload: { userId: state.userId, x: state.x, y: state.y, z: state.z, yaw: state.yaw, pitch: state.pitch },
      },
    );
  }
  pendingMoves.clear();
}

/** Démarre la boucle de diffusion des positions à 10Hz. Idempotent : sans effet si déjà démarrée. */
export function startMoveFlushLoop(): void {
  if (flushLoopStarted) return;
  flushLoopStarted = true;
  setInterval(flushMoves, MOVE_FLUSH_INTERVAL_MS);
}
