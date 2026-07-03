import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { userProfiles } from "../../db/schema.js";

export interface HermesUserProfile {
  profile: string;
  lastMessageConsideredCreatedAt: number;
  updatedAt: number;
}

export function getProfile(userId: string): HermesUserProfile | undefined {
  const row = db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).get();
  return row
    ? { profile: row.profile, lastMessageConsideredCreatedAt: row.lastMessageConsideredCreatedAt, updatedAt: row.updatedAt }
    : undefined;
}

export function upsertProfile(userId: string, profile: string, lastMessageConsideredCreatedAt: number): void {
  const now = Date.now();
  db.insert(userProfiles)
    .values({ userId, profile, lastMessageConsideredCreatedAt, updatedAt: now })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: { profile, lastMessageConsideredCreatedAt, updatedAt: now },
    })
    .run();
}
