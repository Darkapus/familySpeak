import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { importChessComGames } from "../../../api/chess.js";
import { ApiError } from "../../../api/client.js";

export function ImportPanel() {
  const [username, setUsername] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: importChessComGames,
    onSuccess: (data) => {
      setFeedback(`${data.importedCount} partie(s) importée(s), ${data.skippedCount} déjà connue(s) ou ignorée(s).`);
      void queryClient.invalidateQueries({ queryKey: ["chess", "games"] });
    },
    onError: (err) => {
      setFeedback(err instanceof ApiError ? err.message : "Échec de l'import.");
    },
  });

  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-sm text-slate-600">
        Importe tes 10 dernières parties depuis chess.com (les plus récentes, pour refléter ton niveau actuel).
      </p>
      <div className="flex gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Pseudo chess.com"
          className="min-h-11 flex-1 rounded-full border border-slate-200 px-4 text-sm"
        />
        <button
          disabled={!username.trim() || mutation.isPending}
          onClick={() => mutation.mutate(username.trim())}
          className="min-h-11 shrink-0 rounded-full bg-emerald-500 px-4 text-sm font-bold text-white shadow hover:bg-emerald-600 disabled:opacity-50"
        >
          {mutation.isPending ? "Import…" : "Importer"}
        </button>
      </div>
      {feedback && <p className="text-sm text-slate-500">{feedback}</p>}
    </div>
  );
}
