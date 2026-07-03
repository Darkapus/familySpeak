import type { MessageDTO } from "./types.js";

/** Messages envoyés du client vers le serveur. */
export type ClientToServerEvent =
  | { type: "message:send"; payload: { conversationId: string; tempId: string; content?: string; attachmentIds?: string[] } }
  | { type: "typing:start"; payload: { conversationId: string } }
  | { type: "typing:stop"; payload: { conversationId: string } }
  | { type: "message:read"; payload: { conversationId: string; messageId: string } }
  | { type: "presence:ping"; payload: Record<string, never> };

/** Messages envoyés du serveur vers le client. */
export type ServerToClientEvent =
  | { type: "message:new"; payload: { message: MessageDTO } }
  | { type: "message:ack"; payload: { tempId: string; messageId: string; conversationId: string; createdAt: number } }
  | { type: "message:delivered"; payload: { messageId: string; userId: string; at: number } }
  | { type: "message:read"; payload: { messageId: string; userId: string; at: number } }
  | { type: "typing:update"; payload: { conversationId: string; userId: string; isTyping: boolean } }
  | { type: "presence:update"; payload: { userId: string; status: "online" | "offline"; lastSeenAt: number } }
  | { type: "conversation:updated"; payload: { conversationId: string } }
  | { type: "error"; payload: { message: string } };
