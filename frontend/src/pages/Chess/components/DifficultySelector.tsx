import { useState } from "react";
import { CHESS_ENGINE_SKILL_MAX, CHESS_ENGINE_SKILL_MIN } from "@familyspeak/shared";
import type { ChessPlayerColor } from "@familyspeak/shared";

interface DifficultySelectorProps {
  onStart: (color: ChessPlayerColor, level: number) => void;
}

const LEVELS = Array.from(
  { length: CHESS_ENGINE_SKILL_MAX - CHESS_ENGINE_SKILL_MIN + 1 },
  (_, i) => CHESS_ENGINE_SKILL_MIN + i,
);

export function DifficultySelector({ onStart }: DifficultySelectorProps) {
  const [level, setLevel] = useState(3);
  const [color, setColor] = useState<ChessPlayerColor>("white");

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-600">Niveau du moteur</p>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                l === level ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-600">Ta couleur</p>
        <div className="flex gap-2">
          <button
            onClick={() => setColor("white")}
            className={`min-h-11 flex-1 rounded-full px-4 text-sm font-bold ${
              color === "white" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            ♔ Blancs
          </button>
          <button
            onClick={() => setColor("black")}
            className={`min-h-11 flex-1 rounded-full px-4 text-sm font-bold ${
              color === "black" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            ♚ Noirs
          </button>
        </div>
      </div>
      <button
        onClick={() => onStart(color, level)}
        className="min-h-11 rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-emerald-600"
      >
        ♟️ Nouvelle partie
      </button>
    </div>
  );
}
