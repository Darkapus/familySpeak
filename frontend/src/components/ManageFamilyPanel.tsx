import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createChildUser, listUsers, setUserActive } from "../api/users.js";
import { ApiError } from "../api/client.js";
import { Avatar } from "./Avatar.js";

export function ManageFamilyPanel({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["users"], queryFn: listUsers });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createChildUser({ username, password, displayName }),
    onSuccess: () => {
      setUsername("");
      setPassword("");
      setDisplayName("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Erreur"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setUserActive(id, isActive),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate();
  }

  const children = data?.users.filter((u) => u.role === "child") ?? [];

  return (
    <div className="border-b border-slate-100 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Gérer la famille</h2>
        <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">
          Fermer
        </button>
      </div>

      {children.length > 0 && (
        <ul className="mb-3 space-y-1">
          {children.map((u) => (
            <li key={u.id} className="flex items-center gap-2 justify-between rounded-xl p-1.5 text-sm">
              <span className="flex items-center gap-2">
                <Avatar id={u.id} name={u.displayName} size="sm" />
                <span className={u.isActive ? "font-medium text-slate-700" : "text-slate-400 line-through"}>
                  {u.displayName} ({u.username})
                </span>
              </span>
              <button
                onClick={() => toggleMutation.mutate({ id: u.id, isActive: !u.isActive })}
                className="rounded bg-slate-200 px-2 py-0.5 text-xs hover:bg-slate-300"
              >
                {u.isActive ? "Désactiver" : "Réactiver"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Identifiant (ex: lea)"
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          required
        />
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Prénom affiché"
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          required
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Mot de passe (8 caractères min.)"
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          required
          minLength={8}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="w-full rounded-lg bg-emerald-600 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Créer le compte enfant
        </button>
      </form>
    </div>
  );
}
