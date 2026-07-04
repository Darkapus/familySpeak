import { Link } from "react-router-dom";
import { GameCanvas } from "./GameCanvas.js";

export function GamePage() {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-black text-white">
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
        <Link to="/" className="text-sm font-semibold text-white/80 hover:text-white">
          ← Retour
        </Link>
        <h1 className="text-sm font-bold">🧱 Espace de jeu</h1>
      </header>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <GameCanvas />
      </div>
    </div>
  );
}
