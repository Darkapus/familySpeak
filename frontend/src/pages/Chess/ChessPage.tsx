import { useState } from "react";
import { Link } from "react-router-dom";
import { useChessGame } from "./hooks/useChessGame.js";
import { useChessRealtimeSync } from "./hooks/useChessRealtimeSync.js";
import { ChessBoard } from "./components/ChessBoard.js";
import { DifficultySelector } from "./components/DifficultySelector.js";
import { GameHistoryList } from "./components/GameHistoryList.js";
import { GameReplay } from "./components/GameReplay.js";
import { ImportPanel } from "./components/ImportPanel.js";
import { WeaknessProfilePanel } from "./components/WeaknessProfilePanel.js";
import { LessonsPanel } from "./components/LessonsPanel.js";
import { PositionChat } from "./components/PositionChat.js";

type Tab = "play" | "games" | "profile" | "lessons";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "play", label: "♟️ Jouer" },
  { id: "games", label: "📜 Parties" },
  { id: "profile", label: "📊 Progrès" },
  { id: "lessons", label: "🎓 Leçons" },
];

// Composant séparé pour que le Worker Stockfish (WASM, ~7 Mo) ne soit chargé que quand l'enfant
// ouvre réellement l'onglet "Jouer", pas à chaque visite de la page échecs.
function PlayTab() {
  const [gameStarted, setGameStarted] = useState(false);
  const game = useChessGame(3);

  if (!gameStarted) {
    return (
      <DifficultySelector
        onStart={(color, level) => {
          game.startNewGame(color, level);
          setGameStarted(true);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <ChessBoard
        fen={game.fen}
        onDrop={game.onDrop}
        onSquareClick={game.onSquareClick}
        selectedSquare={game.selectedSquare}
        boardOrientation={game.playerColor}
        arePiecesDraggable={game.isPlayerTurn}
      />
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-600">
          {game.isGameOver ? game.resultLabel : game.isPlayerTurn ? "À toi de jouer" : "Le moteur réfléchit…"}
        </p>
        {game.isGameOver ? (
          <button
            onClick={() => setGameStarted(false)}
            className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-600"
          >
            Nouvelle partie
          </button>
        ) : (
          <button
            onClick={game.resign}
            className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200"
          >
            Abandonner
          </button>
        )}
      </div>
      <div className="h-64 overflow-hidden rounded-xl border border-slate-100">
        <PositionChat fen={game.fen} />
      </div>
    </div>
  );
}

export function ChessPage() {
  useChessRealtimeSync();
  const [tab, setTab] = useState<Tab>("play");
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-white">
      <header className="flex shrink-0 items-center gap-3 bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3">
        <Link to="/" className="text-sm font-semibold text-white/80 hover:text-white">
          ← Retour
        </Link>
        <h1 className="text-sm font-bold text-white">♟️ Échecs</h1>
      </header>

      {!selectedGameId && (
        <nav className="flex shrink-0 border-b border-slate-100">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-sm font-semibold ${
                tab === t.id ? "border-b-2 border-emerald-500 text-emerald-600" : "text-slate-400"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {selectedGameId ? (
          <GameReplay gameId={selectedGameId} onBack={() => setSelectedGameId(null)} />
        ) : tab === "play" ? (
          <PlayTab />
        ) : tab === "games" ? (
          <div>
            <ImportPanel />
            <GameHistoryList onSelect={setSelectedGameId} />
          </div>
        ) : tab === "profile" ? (
          <WeaknessProfilePanel />
        ) : (
          <LessonsPanel />
        )}
      </div>
    </div>
  );
}
