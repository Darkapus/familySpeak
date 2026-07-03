import type { ConversationDTO, MessageDTO } from "@familyspeak/shared";
import { isUserOnline } from "../../ws/registry.js";
import { sendPushToUser } from "./sender.js";

function previewFor(message: MessageDTO): string {
  if (message.type === "image") return "📷 Photo";
  if (message.type === "video") return "🎥 Vidéo";
  return message.content ?? "";
}

export function notifyOfflineMembers(conversation: ConversationDTO, message: MessageDTO): void {
  const sender = conversation.members.find((m) => m.id === message.senderId);
  const title = sender?.displayName ?? "Nouveau message";
  const body = previewFor(message);

  for (const member of conversation.members) {
    if (member.id === message.senderId || isUserOnline(member.id)) continue;
    void sendPushToUser(member.id, { title, body, conversationId: conversation.id });
  }
}
