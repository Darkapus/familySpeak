import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { pushSubscriptions } from "../../db/schema.js";

export function upsertPushSubscription(input: {
  userId: string;
  endpoint: string;
  keysP256dh: string;
  keysAuth: string;
}): void {
  const existing = db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, input.endpoint)).get();
  if (existing) {
    db.update(pushSubscriptions)
      .set({ userId: input.userId, keysP256dh: input.keysP256dh, keysAuth: input.keysAuth })
      .where(eq(pushSubscriptions.endpoint, input.endpoint))
      .run();
    return;
  }
  db.insert(pushSubscriptions)
    .values({
      id: crypto.randomUUID(),
      userId: input.userId,
      endpoint: input.endpoint,
      keysP256dh: input.keysP256dh,
      keysAuth: input.keysAuth,
      createdAt: Date.now(),
    })
    .run();
}

export function listPushSubscriptionsForUser(userId: string) {
  return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)).all();
}

export function deletePushSubscriptionByEndpoint(endpoint: string): void {
  db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).run();
}
