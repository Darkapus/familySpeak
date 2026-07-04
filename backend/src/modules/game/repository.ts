import { db } from "../../db/client.js";
import { worldBlocks } from "../../db/schema.js";
import type { GameBlockType, WorldBlockDTO } from "@familyspeak/shared";

type WorldBlockRow = typeof worldBlocks.$inferSelect;

function toDTO(row: WorldBlockRow): WorldBlockDTO {
  return { x: row.x, y: row.y, z: row.z, blockType: row.blockType, updatedAt: row.updatedAt };
}

export function listWorldBlocks(): WorldBlockDTO[] {
  return db.select().from(worldBlocks).all().map(toDTO);
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
