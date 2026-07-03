import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ComponentProps } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { MessageDTO } from "@familyspeak/shared";
import { listConversations } from "../api/conversations.js";
import { listMessages, sendMessage } from "../api/messages.js";
import { attachmentFileUrl, attachmentThumbnailUrl, uploadAttachment } from "../api/attachments.js";
import { conversationDisplayName } from "../lib/conversation.js";
import { useAuthStore } from "../store/auth.js";
import { useWsStore } from "../store/ws.js";
import { useRealtimeStore } from "../store/realtime.js";
import { Avatar } from "./Avatar.js";
import { avatarColorForId } from "../lib/avatarColor.js";

type PendingMessage = MessageDTO & { pending?: boolean };
type MessagesQueryData = { messages: MessageDTO[]; nextBefore: number | null };

const TYPING_STOP_DELAY_MS = 2000;
const EMPTY_TYPING_MAP: Record<string, boolean> = {};
const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

// Rendu markdown minimal pour les bulles de discussion : pas de plugin typography, on démonte
// donc les marges par défaut du navigateur et on rétrograde les titres pour rester compact.
const markdownComponents = {
  p: (props: ComponentProps<"p">) => <p className="mb-1 last:mb-0" {...props} />,
  ul: (props: ComponentProps<"ul">) => <ul className="mb-1 list-disc space-y-0.5 pl-5 last:mb-0" {...props} />,
  ol: (props: ComponentProps<"ol">) => <ol className="mb-1 list-decimal space-y-0.5 pl-5 last:mb-0" {...props} />,
  a: (props: ComponentProps<"a">) => <a className="underline" target="_blank" rel="noreferrer" {...props} />,
  code: (props: ComponentProps<"code">) => <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-sm" {...props} />,
  pre: (props: ComponentProps<"pre">) => (
    <pre className="mb-1 overflow-x-auto rounded-lg bg-black/10 p-2 font-mono text-sm last:mb-0" {...props} />
  ),
  blockquote: (props: ComponentProps<"blockquote">) => (
    <blockquote className="border-l-2 border-current/30 pl-2 italic" {...props} />
  ),
  h1: (props: ComponentProps<"p">) => <p className="font-bold" {...props} />,
  h2: (props: ComponentProps<"p">) => <p className="font-bold" {...props} />,
  h3: (props: ComponentProps<"p">) => <p className="font-bold" {...props} />,
};

export function ConversationDetail({
  conversationId,
  onBack,
  onOpenProfile,
}: {
  conversationId: string;
  onBack: () => void;
  onOpenProfile?: (userId: string, displayName: string) => void;
}) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const currentUserDisplayName = useAuthStore((state) => state.user?.displayName);
  const wsSend = useWsStore((state) => state.send);
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const lastReadMessageId = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { data: conversationsData } = useQuery({ queryKey: ["conversations"], queryFn: listConversations });
  const conversation = conversationsData?.conversations.find((c) => c.id === conversationId);

  const { data: messagesData, isLoading } = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => listMessages(conversationId),
  });

  const typingUsers = useRealtimeStore((state) => state.typingByConversation[conversationId] ?? EMPTY_TYPING_MAP);
  const readByMessageId = useRealtimeStore((state) => state.readByMessageId);
  const streamingMessageIds = useRealtimeStore((state) => state.streamingMessageIds);
  const presenceByUserId = useRealtimeStore((state) => state.presenceByUserId);

  const restMutation = useMutation({
    mutationFn: (text: string) => sendMessage(conversationId, text),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAttachment(conversationId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    },
  });

  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) uploadMutation.mutate(file);
  }

  useEffect(() => {
    const messages = messagesData?.messages;
    if (!messages || messages.length === 0 || !wsSend) return;
    const latest = messages[messages.length - 1]!;
    // Un message optimiste (tempId) n'existe pas encore côté serveur : attendre sa confirmation
    // (message:ack) avant de pouvoir envoyer un accusé de lecture le concernant.
    if ((latest as PendingMessage).pending) return;
    if (latest.id === lastReadMessageId.current) return;
    lastReadMessageId.current = latest.id;
    wsSend({ type: "message:read", payload: { conversationId, messageId: latest.id } });
  }, [messagesData, wsSend, conversationId]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [conversationId, messagesData?.messages.length]);

  if (!currentUserId) {
    return null;
  }

  function notifyTyping(isTyping: boolean) {
    if (!wsSend) return;
    if (isTyping === isTypingRef.current) return;
    isTypingRef.current = isTyping;
    wsSend({ type: isTyping ? "typing:start" : "typing:stop", payload: { conversationId } });
  }

  function handleContentChange(value: string) {
    setContent(value);
    if (value.trim()) {
      notifyTyping(true);
      if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
      typingStopTimer.current = setTimeout(() => notifyTyping(false), TYPING_STOP_DELAY_MS);
    } else {
      notifyTyping(false);
    }
  }

  function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setContent("");
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    notifyTyping(false);

    if (wsSend) {
      const tempId = crypto.randomUUID();
      const optimisticMessage: PendingMessage = {
        id: tempId,
        conversationId,
        senderId: currentUserId!,
        content: trimmed,
        type: "text",
        createdAt: Date.now(),
        editedAt: null,
        attachments: [],
        pending: true,
      };
      queryClient.setQueryData<MessagesQueryData>(["messages", conversationId], (old) =>
        old ? { ...old, messages: [...old.messages, optimisticMessage] } : old,
      );
      wsSend({ type: "message:send", payload: { conversationId, tempId, content: trimmed } });
      return;
    }

    restMutation.mutate(trimmed);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    sendText(content);
  }

  function handleQuickEmoji(emoji: string) {
    sendText(emoji);
  }

  function senderName(senderId: string): string {
    if (senderId === currentUserId) return "Moi";
    return conversation?.members.find((m) => m.id === senderId)?.displayName ?? "?";
  }

  const typingDisplayNames = Object.entries(typingUsers)
    .filter(([userId, isTyping]) => isTyping && userId !== currentUserId)
    .map(([userId]) => conversation?.members.find((m) => m.id === userId)?.displayName ?? "Quelqu'un");

  const otherMember = conversation?.type === "direct" ? conversation.members.find((m) => m.id !== currentUserId) : null;
  const presence = otherMember ? presenceByUserId[otherMember.id] : undefined;

  const messages = messagesData?.messages ?? [];
  const lastOwnMessage = [...messages].reverse().find((m) => m.senderId === currentUserId);
  const lastOwnMessageRead = lastOwnMessage ? (readByMessageId[lastOwnMessage.id]?.size ?? 0) > 0 : false;

  const headerAvatarId = otherMember?.id ?? conversationId;
  const headerName = conversation ? conversationDisplayName(conversation, currentUserId) : "...";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-50">
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-100 bg-white px-4 py-3 shadow-sm">
        <button
          onClick={onBack}
          className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl text-slate-500 hover:bg-slate-100 md:hidden"
        >
          ←
        </button>
        {conversation?.type === "group" ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xl">
            👨‍👩‍👧‍👦
          </div>
        ) : (
          <button
            onClick={() => {
              if (!otherMember) return;
              // Le compte de l'IA n'a pas de profil : dans une conversation avec elle, son
              // avatar ouvre plutôt le profil que l'IA a construit sur l'utilisateur courant.
              if (otherMember.isAiAssistant && currentUserId && currentUserDisplayName) {
                onOpenProfile?.(currentUserId, currentUserDisplayName);
              } else {
                onOpenProfile?.(otherMember.id, headerName);
              }
            }}
            aria-label={`Voir le profil de ${headerName}`}
            className="shrink-0 rounded-full"
          >
            <Avatar id={headerAvatarId} name={headerName} size="md" />
          </button>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-slate-800">{headerName}</h2>
          {presence && (
            <p className={`text-sm font-medium ${presence.status === "online" ? "text-emerald-600" : "text-slate-400"}`}>
              {presence.status === "online" ? "🟢 En ligne" : "Hors ligne"}
            </p>
          )}
        </div>
      </header>

      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4">
        {isLoading && <p className="text-base text-slate-400">Chargement...</p>}
        <div className="space-y-3">
          {messages.map((message) => {
            const isOwn = message.senderId === currentUserId;
            const pending = (message as PendingMessage).pending;
            const sender = conversation?.members.find((m) => m.id === message.senderId);
            const senderColor = avatarColorForId(message.senderId);
            const isStreaming = streamingMessageIds[message.id] ?? false;
            return (
              <div key={message.id} className={`flex items-end gap-2 ${isOwn ? "justify-end" : "justify-start"}`}>
                {!isOwn && conversation?.type === "group" && (
                  <Avatar id={message.senderId} name={sender?.displayName ?? "?"} size="sm" />
                )}
                <div
                  className={`max-w-[75%] rounded-3xl px-4 py-3 shadow-sm sm:max-w-xs ${
                    isOwn ? "bg-emerald-500 text-white" : "bg-white text-slate-800"
                  } ${pending ? "opacity-60" : ""}`}
                >
                  {!isOwn && conversation?.type === "group" && (
                    <p className={`mb-0.5 text-sm font-bold ${senderColor.text}`}>{senderName(message.senderId)}</p>
                  )}
                  {message.type === "image" && message.attachments[0] && (
                    <img
                      src={attachmentFileUrl(message.attachments[0].id)}
                      alt=""
                      className="max-w-full rounded-2xl"
                      loading="lazy"
                    />
                  )}
                  {message.type === "video" && message.attachments[0] && (
                    <video
                      controls
                      poster={attachmentThumbnailUrl(message.attachments[0].id)}
                      src={attachmentFileUrl(message.attachments[0].id)}
                      className="max-w-full rounded-2xl"
                    />
                  )}
                  {message.type === "text" && (
                    <div className="text-base leading-snug">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {(message.content ?? "") + (isStreaming ? " ▍" : "")}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {lastOwnMessage && lastOwnMessageRead && <p className="mt-1 text-right text-sm text-slate-400">Vu ✓✓</p>}
        {typingDisplayNames.length > 0 && (
          <p className="mt-1 text-sm italic text-slate-400">{typingDisplayNames.join(", ")} écrit...</p>
        )}
      </div>

      <div className="flex shrink-0 gap-2 overflow-x-auto overflow-y-hidden border-t border-slate-100 bg-white px-3 pt-2">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => handleQuickEmoji(emoji)}
            className="shrink-0 rounded-full px-2 py-1 text-2xl transition hover:scale-125 hover:bg-slate-100"
          >
            {emoji}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex shrink-0 items-center gap-2 bg-white p-3">
        <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-2xl hover:bg-slate-100">
          📎
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
            onChange={handleFileSelected}
            className="hidden"
            disabled={uploadMutation.isPending}
          />
        </label>
        <input
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Écris un message..."
          className="flex-1 rounded-full border-2 border-slate-200 px-5 py-3 text-base focus:border-emerald-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!content.trim() || restMutation.isPending}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xl text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-40"
          aria-label="Envoyer"
        >
          ➤
        </button>
      </form>
      {uploadMutation.isPending && <p className="bg-white px-3 pb-2 text-sm text-slate-400">Envoi du fichier...</p>}
      {uploadMutation.isError && <p className="bg-white px-3 pb-2 text-sm text-red-500">Échec de l'envoi du fichier</p>}
    </div>
  );
}
