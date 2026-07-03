import { create } from "zustand";

interface RealtimeState {
  typingByConversation: Record<string, Record<string, boolean>>;
  presenceByUserId: Record<string, { status: "online" | "offline"; lastSeenAt: number }>;
  readByMessageId: Record<string, Set<string>>;
  streamingMessageIds: Record<string, boolean>;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
  setPresence: (userId: string, status: "online" | "offline", lastSeenAt: number) => void;
  setRead: (messageId: string, userId: string) => void;
  setStreaming: (messageId: string, streaming: boolean) => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  typingByConversation: {},
  presenceByUserId: {},
  readByMessageId: {},
  streamingMessageIds: {},
  setTyping: (conversationId, userId, isTyping) =>
    set((state) => ({
      typingByConversation: {
        ...state.typingByConversation,
        [conversationId]: { ...state.typingByConversation[conversationId], [userId]: isTyping },
      },
    })),
  setPresence: (userId, status, lastSeenAt) =>
    set((state) => ({ presenceByUserId: { ...state.presenceByUserId, [userId]: { status, lastSeenAt } } })),
  setRead: (messageId, userId) =>
    set((state) => {
      const existing = state.readByMessageId[messageId] ?? new Set<string>();
      const next = new Set(existing);
      next.add(userId);
      return { readByMessageId: { ...state.readByMessageId, [messageId]: next } };
    }),
  setStreaming: (messageId, streaming) =>
    set((state) => {
      if (!streaming) {
        const { [messageId]: _removed, ...rest } = state.streamingMessageIds;
        return { streamingMessageIds: rest };
      }
      return { streamingMessageIds: { ...state.streamingMessageIds, [messageId]: true } };
    }),
}));
