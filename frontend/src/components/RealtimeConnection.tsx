import { useQueryClient } from "@tanstack/react-query";
import type { MessageDTO, ServerToClientEvent } from "@familyspeak/shared";
import { useWebSocket } from "../hooks/useWebSocket.js";
import { useRealtimeStore } from "../store/realtime.js";

type MessagesQueryData = { messages: MessageDTO[]; nextBefore: number | null };

export function RealtimeConnection() {
  const queryClient = useQueryClient();

  useWebSocket((event: ServerToClientEvent) => {
    switch (event.type) {
      case "message:new": {
        const { message } = event.payload;
        queryClient.setQueryData<MessagesQueryData>(["messages", message.conversationId], (old) => {
          if (!old) return old;
          if (old.messages.some((m) => m.id === message.id)) return old;
          return { ...old, messages: [...old.messages, message] };
        });
        return;
      }
      case "message:ack": {
        const { tempId, messageId, conversationId, createdAt } = event.payload;
        queryClient.setQueryData<MessagesQueryData>(["messages", conversationId], (old) => {
          if (!old) return old;
          return {
            ...old,
            messages: old.messages.map((m) => (m.id === tempId ? { ...m, id: messageId, createdAt } : m)),
          };
        });
        return;
      }
      case "typing:update": {
        const { conversationId, userId, isTyping } = event.payload;
        useRealtimeStore.getState().setTyping(conversationId, userId, isTyping);
        return;
      }
      case "presence:update": {
        const { userId, status, lastSeenAt } = event.payload;
        useRealtimeStore.getState().setPresence(userId, status, lastSeenAt);
        return;
      }
      case "message:read": {
        const { messageId, userId } = event.payload;
        useRealtimeStore.getState().setRead(messageId, userId);
        return;
      }
      default:
        return;
    }
  });

  return null;
}
