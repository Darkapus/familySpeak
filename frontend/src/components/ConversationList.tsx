import { useQuery } from "@tanstack/react-query";
import { listConversations } from "../api/conversations.js";
import { conversationDisplayName } from "../lib/conversation.js";
import { useAuthStore } from "../store/auth.js";
import { Avatar } from "./Avatar.js";

export function ConversationList({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { data, isLoading } = useQuery({ queryKey: ["conversations"], queryFn: listConversations });

  if (!currentUserId) {
    return null;
  }

  if (isLoading) {
    return <p className="p-4 text-base text-slate-400">Chargement...</p>;
  }

  const conversations = data?.conversations ?? [];

  if (conversations.length === 0) {
    return (
      <p className="p-6 text-center text-base text-slate-400">
        👋 Aucune discussion pour l'instant.
        <br />
        Appuie sur "Nouvelle discussion" pour commencer !
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {conversations.map((conversation) => {
        const name = conversationDisplayName(conversation, currentUserId);
        const otherMember = conversation.members.find((m) => m.id !== currentUserId);
        return (
          <li key={conversation.id}>
            <button
              onClick={() => onSelect(conversation.id)}
              className={`flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-slate-50 ${
                selectedId === conversation.id ? "bg-emerald-50" : ""
              }`}
            >
              {conversation.type === "group" ? (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xl">
                  👨‍👩‍👧‍👦
                </div>
              ) : (
                <Avatar id={otherMember?.id ?? conversation.id} name={name} size="md" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-slate-800">{name}</p>
                <p className="text-sm text-slate-400">
                  {conversation.type === "group" ? `${conversation.members.length} membres` : "Discussion"}
                </p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
