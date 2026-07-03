import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { hermesConversationSummaries } from "../../db/schema.js";

export interface HermesConversationSummary {
  summary: string;
  summarizedUpToCreatedAt: number;
}

export function getSummary(conversationId: string): HermesConversationSummary | undefined {
  const row = db
    .select()
    .from(hermesConversationSummaries)
    .where(eq(hermesConversationSummaries.conversationId, conversationId))
    .get();
  return row ? { summary: row.summary, summarizedUpToCreatedAt: row.summarizedUpToCreatedAt } : undefined;
}

export function upsertSummary(conversationId: string, summary: string, summarizedUpToCreatedAt: number): void {
  const now = Date.now();
  db.insert(hermesConversationSummaries)
    .values({ conversationId, summary, summarizedUpToCreatedAt, updatedAt: now })
    .onConflictDoUpdate({
      target: hermesConversationSummaries.conversationId,
      set: { summary, summarizedUpToCreatedAt, updatedAt: now },
    })
    .run();
}
