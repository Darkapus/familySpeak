import { useQuery } from "@tanstack/react-query";
import { listConversations } from "../api/conversations.js";
import { conversationDisplayName } from "../lib/conversation.js";
import { useAuthStore } from "../store/auth.js";
import { Avatar } from "./Avatar.js";

export function ConversationList({
  selectedId,
  onSelect,
  onStartNewConversation,
  onOpenProfile,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onStartNewConversation?: () => void;
  onOpenProfile?: (userId: string, displayName: string) => void;
}) {
  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = currentUser?.id;
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
      <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="text-6xl">👋</span>
        <div className="space-y-1">
          <p className="text-lg font-semibold text-slate-600">Aucune discussion pour l'instant</p>
          <p className="text-base text-slate-400">Lance une discussion avec ta famille !</p>
        </div>
        {onStartNewConversation && (
          <button
            onClick={onStartNewConversation}
            className="mt-2 min-h-11 rounded-full bg-emerald-500 px-6 py-3 text-base font-bold text-white shadow-sm hover:bg-emerald-600"
          >
            💬 Nouvelle discussion
          </button>
        )}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {conversations.map((conversation) => {
        const name = conversationDisplayName(conversation, currentUserId);
        const otherMember = conversation.members.find((m) => m.id !== currentUserId);
        return (
          <li
            key={conversation.id}
            className={`flex items-center gap-3 px-4 py-4 transition hover:bg-slate-50 ${
              selectedId === conversation.id ? "bg-emerald-50" : ""
            }`}
          >
            {conversation.type === "group" ? (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xl">
                👨‍👩‍👧‍👦
              </div>
            ) : (
              <button
                onClick={() => {
                  if (!otherMember) return;
                  // Le compte de l'IA n'a pas de profil : dans une conversation avec elle, son
                  // avatar ouvre plutôt le profil que l'IA a construit sur l'utilisateur courant.
                  if (otherMember.isAiAssistant && currentUser) {
                    onOpenProfile?.(currentUser.id, currentUser.displayName);
                  } else {
                    onOpenProfile?.(otherMember.id, name);
                  }
                }}
                aria-label={`Voir le profil de ${name}`}
                className="shrink-0 rounded-full"
              >
                <Avatar id={otherMember?.id ?? conversation.id} name={name} size="md" />
              </button>
            )}
            <button onClick={() => onSelect(conversation.id)} className="min-w-0 flex-1 text-left">
              <p className="truncate text-base font-semibold text-slate-800">{name}</p>
              <p className="text-sm text-slate-400">
                {conversation.type === "group" ? `${conversation.members.length} membres` : "Discussion"}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
