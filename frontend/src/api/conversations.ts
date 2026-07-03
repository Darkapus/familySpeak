import type { ConversationDTO, ConversationType } from "@familyspeak/shared";
import { api } from "./client.js";

export function listConversations() {
  return api.get<{ conversations: ConversationDTO[] }>("/conversations");
}

export function createConversation(input: { type: ConversationType; memberIds: string[]; name?: string }) {
  return api.post<{ conversation: ConversationDTO }>("/conversations", input);
}

export function addConversationMember(conversationId: string, userId: string) {
  return api.post<{ conversation: ConversationDTO }>(`/conversations/${conversationId}/members`, { userId });
}
