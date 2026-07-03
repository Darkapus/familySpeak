import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import { conversations, conversationMembers, users } from "../../db/schema.js";
import { userToDTO } from "../users/repository.js";
import type { ConversationDTO, ConversationType } from "@familyspeak/shared";

type ConversationRow = typeof conversations.$inferSelect;

function toDTO(row: ConversationRow, memberUserIds: string[]): ConversationDTO {
  const memberRows = memberUserIds.length
    ? db.select().from(users).where(inArray(users.id, memberUserIds)).all()
    : [];
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    avatarUrl: row.avatarUrl,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    members: memberRows.map(userToDTO),
  };
}

export function getConversationWithMembers(id: string): ConversationDTO | undefined {
  const row = db.select().from(conversations).where(eq(conversations.id, id)).get();
  if (!row) return undefined;
  const memberIds = db
    .select({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(eq(conversationMembers.conversationId, id))
    .all()
    .map((m) => m.userId);
  return toDTO(row, memberIds);
}

export function listConversationsForUser(userId: string): ConversationDTO[] {
  const memberships = db
    .select({ conversationId: conversationMembers.conversationId })
    .from(conversationMembers)
    .where(eq(conversationMembers.userId, userId))
    .all();

  return memberships
    .map((m) => getConversationWithMembers(m.conversationId))
    .filter((c): c is ConversationDTO => c !== undefined)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function listConversationPartnerIds(userId: string): string[] {
  const partnerIds = new Set<string>();
  for (const conversation of listConversationsForUser(userId)) {
    for (const member of conversation.members) {
      if (member.id !== userId) partnerIds.add(member.id);
    }
  }
  return Array.from(partnerIds);
}

export function isMember(conversationId: string, userId: string): boolean {
  return (
    db
      .select()
      .from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)))
      .get() !== undefined
  );
}

export function findDirectConversationBetween(userIdA: string, userIdB: string): ConversationDTO | undefined {
  const candidateIds = db
    .select({ conversationId: conversationMembers.conversationId })
    .from(conversationMembers)
    .where(eq(conversationMembers.userId, userIdA))
    .all()
    .map((m) => m.conversationId);

  for (const conversationId of candidateIds) {
    const row = db.select().from(conversations).where(eq(conversations.id, conversationId)).get();
    if (!row || row.type !== "direct") continue;
    if (isMember(conversationId, userIdB)) {
      return getConversationWithMembers(conversationId);
    }
  }
  return undefined;
}

export function createConversation(input: {
  type: ConversationType;
  name: string | null;
  createdBy: string;
  memberIds: string[];
}): ConversationDTO {
  const id = crypto.randomUUID();
  const now = Date.now();

  db.insert(conversations)
    .values({ id, type: input.type, name: input.name, avatarUrl: null, createdBy: input.createdBy, createdAt: now })
    .run();

  const uniqueMemberIds = Array.from(new Set(input.memberIds));
  for (const userId of uniqueMemberIds) {
    db.insert(conversationMembers).values({ conversationId: id, userId, joinedAt: now, lastReadMessageId: null }).run();
  }

  return getConversationWithMembers(id)!;
}

export function addMemberToConversation(conversationId: string, userId: string): void {
  if (isMember(conversationId, userId)) return;
  db.insert(conversationMembers)
    .values({ conversationId, userId, joinedAt: Date.now(), lastReadMessageId: null })
    .run();
}
