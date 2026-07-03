import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listUsers } from "../api/users.js";
import { createConversation } from "../api/conversations.js";
import { useAuthStore } from "../store/auth.js";
import { Avatar } from "./Avatar.js";

export function NewConversationPanel({ onCreated, onClose }: { onCreated: (id: string) => void; onClose: () => void }) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { data } = useQuery({ queryKey: ["users"], queryFn: listUsers });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      createConversation(
        selectedIds.length === 1
          ? { type: "direct", memberIds: selectedIds }
          : { type: "group", memberIds: selectedIds, name: groupName },
      ),
    onSuccess: ({ conversation }) => {
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onCreated(conversation.id);
    },
  });

  const candidates = (data?.users ?? []).filter((u) => u.id !== currentUserId && u.isActive);
  const isGroup = selectedIds.length > 1;

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="border-b border-slate-100 bg-emerald-50/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-700">Avec qui veux-tu discuter ?</h2>
        <button onClick={onClose} className="rounded-full px-2 py-1 text-sm text-slate-400 hover:bg-slate-200">
          ✕
        </button>
      </div>
      <div className="space-y-1">
        {candidates.map((u) => {
          const checked = selectedIds.includes(u.id);
          return (
            <label
              key={u.id}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl p-2 text-base ${
                checked ? "bg-emerald-100" : "hover:bg-white"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(u.id)}
                className="h-5 w-5 accent-emerald-500"
              />
              <Avatar id={u.id} name={u.displayName} size="sm" />
              <span className="font-semibold text-slate-700">{u.displayName}</span>
            </label>
          );
        })}
      </div>
      {isGroup && (
        <input
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Nom du groupe (ex: La Famille)"
          className="mt-3 w-full rounded-full border-2 border-slate-200 px-4 py-2 text-base focus:border-emerald-400 focus:outline-none"
        />
      )}
      <button
        disabled={selectedIds.length === 0 || (isGroup && !groupName.trim()) || mutation.isPending}
        onClick={() => mutation.mutate()}
        className="mt-3 w-full rounded-full bg-emerald-500 py-3 text-base font-bold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-50"
      >
        🚀 C'est parti !
      </button>
    </div>
  );
}
