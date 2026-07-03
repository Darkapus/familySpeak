import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { attachments, messages } from "../../db/schema.js";

export function insertAttachment(input: {
  messageId: string;
  filePath: string;
  thumbnailPath: string | null;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}): string {
  const id = crypto.randomUUID();
  db.insert(attachments)
    .values({
      id,
      messageId: input.messageId,
      filePath: input.filePath,
      thumbnailPath: input.thumbnailPath,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      width: input.width,
      height: input.height,
      durationSeconds: input.durationSeconds,
    })
    .run();
  return id;
}

export function findAttachmentWithConversation(
  attachmentId: string,
): { filePath: string; thumbnailPath: string | null; mimeType: string; conversationId: string } | undefined {
  const row = db
    .select({
      filePath: attachments.filePath,
      thumbnailPath: attachments.thumbnailPath,
      mimeType: attachments.mimeType,
      conversationId: messages.conversationId,
    })
    .from(attachments)
    .innerJoin(messages, eq(attachments.messageId, messages.id))
    .where(eq(attachments.id, attachmentId))
    .get();
  return row;
}
