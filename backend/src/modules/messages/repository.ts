import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { db } from "../../db/client.js";
import { attachments, conversationMembers, messageReceipts, messages } from "../../db/schema.js";
import type { AttachmentDTO, MessageDTO, MessageType } from "@familyspeak/shared";

type MessageRow = typeof messages.$inferSelect;

function attachmentsForMessage(messageId: string): AttachmentDTO[] {
  return db
    .select()
    .from(attachments)
    .where(eq(attachments.messageId, messageId))
    .all()
    .map((row) => ({
      id: row.id,
      messageId: row.messageId,
      filePath: row.filePath,
      thumbnailPath: row.thumbnailPath,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      width: row.width,
      height: row.height,
      durationSeconds: row.durationSeconds,
    }));
}

function toDTO(row: MessageRow): MessageDTO {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    content: row.content,
    type: row.type,
    createdAt: row.createdAt,
    editedAt: row.editedAt,
    attachments: attachmentsForMessage(row.id),
  };
}

export function findMessageById(id: string): MessageDTO | undefined {
  const row = db.select().from(messages).where(eq(messages.id, id)).get();
  return row ? toDTO(row) : undefined;
}

export function createMediaMessage(input: {
  conversationId: string;
  senderId: string;
  content: string | null;
  type: MessageType;
}): MessageDTO {
  const row: MessageRow = {
    id: crypto.randomUUID(),
    conversationId: input.conversationId,
    senderId: input.senderId,
    content: input.content,
    type: input.type,
    createdAt: Date.now(),
    editedAt: null,
    deletedAt: null,
  };
  db.insert(messages).values(row).run();
  return toDTO(row);
}

export function createTextMessage(input: { conversationId: string; senderId: string; content: string }): MessageDTO {
  const row: MessageRow = {
    id: crypto.randomUUID(),
    conversationId: input.conversationId,
    senderId: input.senderId,
    content: input.content,
    type: "text",
    createdAt: Date.now(),
    editedAt: null,
    deletedAt: null,
  };
  db.insert(messages).values(row).run();
  return toDTO(row);
}

export function listMessages(
  conversationId: string,
  options: { before?: number; limit: number },
): { messages: MessageDTO[]; nextBefore: number | null } {
  const conditions = [eq(messages.conversationId, conversationId), isNull(messages.deletedAt)];
  if (options.before !== undefined) {
    conditions.push(lt(messages.createdAt, options.before));
  }

  const rows = db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(options.limit)
    .all();

  const nextBefore = rows.length === options.limit ? rows[rows.length - 1]!.createdAt : null;

  return { messages: rows.reverse().map(toDTO), nextBefore };
}

export function markMessageRead(conversationId: string, messageId: string, userId: string): void {
  const now = Date.now();
  const existing = db
    .select()
    .from(messageReceipts)
    .where(and(eq(messageReceipts.messageId, messageId), eq(messageReceipts.userId, userId)))
    .get();

  if (existing) {
    db.update(messageReceipts)
      .set({ readAt: now, deliveredAt: existing.deliveredAt ?? now })
      .where(and(eq(messageReceipts.messageId, messageId), eq(messageReceipts.userId, userId)))
      .run();
  } else {
    db.insert(messageReceipts).values({ messageId, userId, deliveredAt: now, readAt: now }).run();
  }

  db.update(conversationMembers)
    .set({ lastReadMessageId: messageId })
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)))
    .run();
}
