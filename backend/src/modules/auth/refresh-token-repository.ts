import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, gt } from "drizzle-orm";
import { db } from "../../db/client.js";
import { refreshTokens } from "../../db/schema.js";
import { env } from "../../config/env.js";

function hashToken(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

export function issueRefreshToken(userId: string): { plain: string; expiresAt: number } {
  const plain = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000;

  db.insert(refreshTokens)
    .values({
      id: crypto.randomUUID(),
      userId,
      tokenHash: hashToken(plain),
      expiresAt,
      revokedAt: null,
    })
    .run();

  return { plain, expiresAt };
}

export function findValidRefreshToken(plain: string) {
  const hash = hashToken(plain);
  return db
    .select()
    .from(refreshTokens)
    .where(and(eq(refreshTokens.tokenHash, hash), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, Date.now())))
    .get();
}

export function revokeRefreshTokenById(id: string): void {
  db.update(refreshTokens).set({ revokedAt: Date.now() }).where(eq(refreshTokens.id, id)).run();
}

export function revokeAllRefreshTokensForUser(userId: string): void {
  db.update(refreshTokens).set({ revokedAt: Date.now() }).where(eq(refreshTokens.userId, userId)).run();
}
