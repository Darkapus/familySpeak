import { useState, type ComponentProps, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { askChessPositionChat } from "../../../api/chess.js";

interface PositionChatProps {
  fen: string;
}

interface ChatEntry {
  role: "user" | "assistant";
  content: string;
}

const markdownComponents = {
  p: (props: ComponentProps<"p">) => <p className="mb-1 last:mb-0" {...props} />,
};

export function PositionChat({ fen }: PositionChatProps) {
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [question, setQuestion] = useState("");

  const mutation = useMutation({
    mutationFn: (q: string) => askChessPositionChat({ fen, question: q, history }),
    onSuccess: (data, q) => {
      setHistory((h) => [...h, { role: "user", content: q }, { role: "assistant", content: data.reply }]);
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || mutation.isPending) return;
    setQuestion("");
    mutation.mutate(trimmed);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {history.length === 0 && (
          <p className="text-sm text-slate-400">Pose une question sur la position actuelle !</p>
        )}
        <div className="flex flex-col gap-2">
          {history.map((entry, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                entry.role === "user" ? "self-end bg-emerald-500 text-white" : "self-start bg-slate-100 text-slate-700"
              }`}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {entry.content}
              </ReactMarkdown>
            </div>
          ))}
          {mutation.isPending && <p className="self-start text-xs text-slate-400">Le coach réfléchit…</p>}
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex shrink-0 gap-2 border-t border-slate-100 p-3">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Que penses-tu de cette position ?"
          className="min-h-11 flex-1 rounded-full border border-slate-200 px-4 text-sm"
        />
        <button
          type="submit"
          disabled={mutation.isPending || !question.trim()}
          className="min-h-11 shrink-0 rounded-full bg-emerald-500 px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          Envoyer
        </button>
      </form>
    </div>
  );
}
