import type { MessageDTO } from "@familyspeak/shared";
import { api } from "./client.js";

export function listMessages(conversationId: string, before?: number) {
  const query = before ? `?before=${before}` : "";
  return api.get<{ messages: MessageDTO[]; nextBefore: number | null }>(`/conversations/${conversationId}/messages${query}`);
}

export function sendMessage(conversationId: string, content: string) {
  return api.post<{ message: MessageDTO }>(`/conversations/${conversationId}/messages`, { content });
}
