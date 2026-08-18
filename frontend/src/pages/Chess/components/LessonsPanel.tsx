import type { ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchChessLessons, markChessLessonRead } from "../../../api/chess.js";

// Rendu markdown minimal (pas de plugin typography dans ce projet), même approche que
// ConversationDetail.tsx pour les bulles de chat.
const markdownComponents = {
  p: (props: ComponentProps<"p">) => <p className="mb-1 last:mb-0" {...props} />,
  ul: (props: ComponentProps<"ul">) => <ul className="mb-1 list-disc space-y-0.5 pl-5 last:mb-0" {...props} />,
  ol: (props: ComponentProps<"ol">) => <ol className="mb-1 list-decimal space-y-0.5 pl-5 last:mb-0" {...props} />,
  strong: (props: ComponentProps<"strong">) => <strong className="font-bold text-slate-800" {...props} />,
};

export function LessonsPanel() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["chess", "lessons"], queryFn: () => fetchChessLessons() });
  const lessons = data?.lessons ?? [];
  const readMutation = useMutation({
    mutationFn: markChessLessonRead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["chess", "lessons"] }),
  });

  if (isLoading) return <p className="p-4 text-sm text-slate-400">Chargement…</p>;
  if (lessons.length === 0) {
    return (
      <p className="p-4 text-sm text-slate-400">
        Pas encore de leçon : joue et fais analyser quelques parties pour que ton profil se dessine !
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {lessons.map((lesson) => (
        <article
          key={lesson.id}
          className={`rounded-xl border p-3 text-sm ${lesson.readAt ? "border-slate-100 bg-white" : "border-emerald-200 bg-emerald-50"}`}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {lesson.contentMarkdown}
          </ReactMarkdown>
          {!lesson.readAt && (
            <button
              onClick={() => readMutation.mutate(lesson.id)}
              className="mt-2 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600"
            >
              Marquer comme lu
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
