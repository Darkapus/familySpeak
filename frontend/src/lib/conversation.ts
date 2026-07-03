import type { ConversationDTO } from "@familyspeak/shared";

export function conversationDisplayName(conversation: ConversationDTO, currentUserId: string): string {
  if (conversation.type === "group") {
    return conversation.name ?? "Groupe";
  }
  const other = conversation.members.find((m) => m.id !== currentUserId);
  return other?.displayName ?? "Conversation";
}
