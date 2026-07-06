import { and, eq, gte, lt } from "drizzle-orm";
import { CHUNK_SIZE } from "@familyspeak/shared";
import { db } from "../../db/client.js";
import { playerHomes, users, worldBlocks } from "../../db/schema.js";
import type { GameBlockType, PlayerHomeDTO, WorldBlockDTO } from "@familyspeak/shared";

type WorldBlockRow = typeof worldBlocks.$inferSelect;

function toDTO(row: WorldBlockRow): WorldBlockDTO {
  return { x: row.x, y: row.y, z: row.z, blockType: row.blockType, updatedAt: row.updatedAt };
}

/** Blocs modifiés dans une zone (chunk) donnée — le monde étant trop grand pour être chargé
 * d'un bloc, le client ne demande que les chunks autour du joueur. */
export function listWorldBlocksInChunk(cx: number, cz: number): WorldBlockDTO[] {
  const minX = cx * CHUNK_SIZE;
  const minZ = cz * CHUNK_SIZE;
  return db
    .select()
    .from(worldBlocks)
    .where(
      and(
        gte(worldBlocks.x, minX),
        lt(worldBlocks.x, minX + CHUNK_SIZE),
        gte(worldBlocks.z, minZ),
        lt(worldBlocks.z, minZ + CHUNK_SIZE),
      ),
    )
    .all()
    .map(toDTO);
}

export function upsertWorldBlock(
  x: number,
  y: number,
  z: number,
  blockType: GameBlockType | null,
  placedBy: string,
): void {
  const updatedAt = Date.now();
  db.insert(worldBlocks)
    .values({ x, y, z, blockType, placedBy, updatedAt })
    .onConflictDoUpdate({
      target: [worldBlocks.x, worldBlocks.y, worldBlocks.z],
      set: { blockType, placedBy, updatedAt },
    })
    .run();
}

const homeColumns = {
  userId: playerHomes.userId,
  displayName: users.displayName,
  x: playerHomes.x,
  y: playerHomes.y,
  z: playerHomes.z,
  yaw: playerHomes.yaw,
  pitch: playerHomes.pitch,
};

/** Tous les repères de spawn définis, y compris ceux des joueurs hors ligne (leur marqueur reste
 * visible pour toute la famille). */
export function listPlayerHomes(): PlayerHomeDTO[] {
  return db.select(homeColumns).from(playerHomes).innerJoin(users, eq(playerHomes.userId, users.id)).all();
}

export function getPlayerHome(userId: string): PlayerHomeDTO | undefined {
  return db
    .select(homeColumns)
    .from(playerHomes)
    .innerJoin(users, eq(playerHomes.userId, users.id))
    .where(eq(playerHomes.userId, userId))
    .get();
}

export function upsertPlayerHome(
  userId: string,
  x: number,
  y: number,
  z: number,
  yaw: number,
  pitch: number,
): void {
  const updatedAt = Date.now();
  db.insert(playerHomes)
    .values({ userId, x, y, z, yaw, pitch, updatedAt })
    .onConflictDoUpdate({
      target: playerHomes.userId,
      set: { x, y, z, yaw, pitch, updatedAt },
    })
    .run();
}
