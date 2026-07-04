import { useState } from "react";
import { GAME_BLOCK_TYPES, type GameBlockType } from "@familyspeak/shared";
import { BLOCK_COLORS } from "../engine/scene.js";
import type { GameInputState } from "../engine/input.js";

function toCssColor(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

/** Bandeau de sélection du bloc à poser. Touche 1-8 au clavier fait la même chose (voir input.ts). */
export function BlockPalette({ inputState }: { inputState: GameInputState }) {
  const [selected, setSelected] = useState<GameBlockType>(inputState.selectedBlockType);

  return (
    <div className="absolute left-1/2 top-3 flex -translate-x-1/2 gap-2 rounded-full bg-black/40 p-2">
      {GAME_BLOCK_TYPES.map((type) => (
        <button
          key={type}
          onClick={() => {
            inputState.selectedBlockType = type;
            setSelected(type);
          }}
          aria-label={type}
          aria-pressed={selected === type}
          className={`h-7 w-7 rounded-full border-2 ${selected === type ? "border-white" : "border-transparent"}`}
          style={{ backgroundColor: toCssColor(BLOCK_COLORS[type]) }}
        />
      ))}
    </div>
  );
}
