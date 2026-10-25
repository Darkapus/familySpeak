import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recordOrthoAttempt } from "../../api/orthographe.js";
import type { OrthoExercise } from "./exercises.js";
import { shuffleOptions } from "./pickSession.js";

interface Props {
  exercises: OrthoExercise[];
  onExit: () => void;
  onReplay: () => void;
}

function verdict(score: number, total: number): { emoji: string; text: string } {
  const ratio = score / total;
  if (ratio === 1) return { emoji: "🏆", text: "Sans faute, bravo champion !" };
  if (ratio >= 0.8) return { emoji: "🌟", text: "Très bien joué !" };
  if (ratio >= 0.5) return { emoji: "👍", text: "Pas mal ! Relis les astuces ci-dessous." };
  return { emoji: "💪", text: "Courage, on s'entraîne pour progresser !" };
}

export function OrthographeSession({ exercises, onExit, onReplay }: Props) {
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [wrong, setWrong] = useState<OrthoExercise[]>([]);
  const [score, setScore] = useState(0);
  const record = useMutation({ mutationFn: recordOrthoAttempt });

  const current = exercises[index];
  // Hooks avant tout return conditionnel (cf. CLAUDE.md, piège n°7).
  const options = useMemo(() => (current ? shuffleOptions(current) : []), [current]);

  if (!current) {
    const { emoji, text } = verdict(score, exercises.length);
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="rounded-2xl bg-emerald-50 p-6 text-center">
          <p className="text-5xl">{emoji}</p>
          <p className="mt-2 text-2xl font-extrabold text-emerald-700">
            {score} / {exercises.length}
          </p>
          <p className="mt-1 text-sm text-emerald-700">{text}</p>
        </div>
        {wrong.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-bold text-slate-700">À retenir</h2>
            {wrong.map((e) => (
              <div key={e.id} className="rounded-xl border border-slate-100 p-3 text-sm">
                <p className="font-semibold text-slate-800">{e.sentence.replace("___", e.answer)}</p>
                <p className="mt-1 text-slate-500">{e.tip}</p>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={onReplay}
            className="min-h-11 flex-1 rounded-full bg-emerald-500 px-4 text-sm font-bold text-white hover:bg-emerald-600"
          >
            Rejouer
          </button>
          <button
            onClick={onExit}
            className="min-h-11 flex-1 rounded-full bg-slate-100 px-4 text-sm font-bold text-slate-600 hover:bg-slate-200"
          >
            Menu
          </button>
        </div>
      </div>
    );
  }

  const answered = selected !== null;
  const isCorrect = selected === current.answer;
  const [before, after] = current.sentence.split("___");

  function choose(option: string) {
    if (answered || !current) return;
    const correct = option === current.answer;
    setSelected(option);
    if (correct) setScore((s) => s + 1);
    else setWrong((w) => [...w, current]);
    record.mutate(
      { itemId: current.id, category: current.category, correct },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orthographe", "stats"] }) },
    );
  }

  function next() {
    setSelected(null);
    setIndex((i) => i + 1);
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${(index / exercises.length) * 100}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-slate-400">
          {index + 1}/{exercises.length}
        </span>
      </div>

      <p className="rounded-2xl bg-slate-50 p-5 text-center text-xl leading-relaxed text-slate-800">
        {before}
        <span
          className={`mx-1 inline-block min-w-16 rounded-lg border-b-4 px-2 font-bold ${
            !answered
              ? "border-slate-300 text-transparent"
              : isCorrect
                ? "border-emerald-500 text-emerald-600"
                : "border-rose-500 text-rose-600"
          }`}
        >
          {selected ?? "___"}
        </span>
        {after}
      </p>

      <div className="grid gap-2">
        {options.map((option) => {
          const style = !answered
            ? "border-slate-200 bg-white text-slate-800 hover:border-emerald-400"
            : option === current.answer
              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
              : option === selected
                ? "border-rose-400 bg-rose-50 text-rose-700"
                : "border-slate-100 bg-white text-slate-300";
          return (
            <button
              key={option}
              onClick={() => choose(option)}
              disabled={answered}
              className={`min-h-12 rounded-xl border-2 px-4 text-lg font-bold ${style}`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="flex flex-col gap-3">
          <div className={`rounded-xl p-3 text-sm ${isCorrect ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
            <p className="font-bold">{isCorrect ? "✅ Bravo !" : `❌ La bonne réponse : ${current.answer}`}</p>
            <p className="mt-1">💡 {current.tip}</p>
          </div>
          <button
            onClick={next}
            className="min-h-11 rounded-full bg-emerald-500 px-4 text-sm font-bold text-white hover:bg-emerald-600"
          >
            {index + 1 === exercises.length ? "Voir mon score" : "Suivant →"}
          </button>
        </div>
      )}
    </div>
  );
}
