import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { useMutation } from "@tanstack/react-query";
import type { ChessGameResult, ChessPlayerColor } from "@familyspeak/shared";
import { saveChessGame } from "../../../api/chess.js";
import { ChessEngineClient } from "../engine/stockfishClient.js";

export interface ChessGameState {
  fen: string;
  playerColor: ChessPlayerColor;
  engineLevel: number;
  isGameOver: boolean;
  resultLabel: string | null;
  engineThinking: boolean;
  isPlayerTurn: boolean;
  selectedSquare: string | null;
  onDrop: (sourceSquare: string, targetSquare: string) => boolean;
  onSquareClick: (square: string) => void;
  resign: () => void;
  startNewGame: (playerColor: ChessPlayerColor, engineLevel: number) => void;
}

function resultFromGameOver(chess: Chess): ChessGameResult {
  if (chess.isCheckmate()) {
    return chess.turn() === "w" ? "0-1" : "1-0";
  }
  return "1/2-1/2";
}

/** Gère une partie vs Stockfish WASM : état chess.js, coups du moteur, détection de fin de
 * partie et sauvegarde automatique du PGN. Toutes les fonctions internes reçoivent l'instance
 * chess.js et la couleur du joueur en paramètre explicite (jamais via une closure sur le state
 * React) pour éviter tout problème de valeur périmée entre startNewGame et le premier coup du
 * moteur, qui s'enchaînent dans le même appel avant que React n'ait ré-rendu. */
export function useChessGame(initialLevel: number): ChessGameState {
  const chessRef = useRef(new Chess());
  const engineRef = useRef<ChessEngineClient | null>(null);
  const savedRef = useRef(false);

  const [fen, setFen] = useState(() => chessRef.current.fen());
  const [playerColor, setPlayerColor] = useState<ChessPlayerColor>("white");
  const [engineLevel, setEngineLevel] = useState(initialLevel);
  const [isGameOver, setIsGameOver] = useState(false);
  const [resultLabel, setResultLabel] = useState<string | null>(null);
  const [engineThinking, setEngineThinking] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  const saveMutation = useMutation({ mutationFn: saveChessGame });

  useEffect(() => {
    const engine = new ChessEngineClient();
    engineRef.current = engine;
    void engine.setSkillLevel(initialLevel);
    return () => engine.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishIfGameOver = useCallback(
    (chess: Chess, color: ChessPlayerColor, level: number): boolean => {
      if (!chess.isGameOver()) return false;
      setIsGameOver(true);
      const result = resultFromGameOver(chess);
      const playerWon = result === (color === "white" ? "1-0" : "0-1");
      setResultLabel(result === "1/2-1/2" ? "Partie nulle" : playerWon ? "Tu as gagné !" : "Le moteur a gagné");
      if (!savedRef.current) {
        savedRef.current = true;
        saveMutation.mutate({ pgn: chess.pgn(), result, playerColor: color, engineLevel: level });
      }
      return true;
    },
    [saveMutation],
  );

  const playEngineMoveIfNeeded = useCallback(
    async (chess: Chess, color: ChessPlayerColor, level: number) => {
      const engineColor = color === "white" ? "b" : "w";
      if (chess.turn() !== engineColor || chess.isGameOver()) return;
      setEngineThinking(true);
      try {
        const uci = await engineRef.current!.getBestMove(chess.fen());
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promotion = uci.slice(4, 5) || undefined;
        chess.move({ from, to, promotion });
        setFen(chess.fen());
      } finally {
        setEngineThinking(false);
      }
      finishIfGameOver(chess, color, level);
    },
    [finishIfGameOver],
  );

  const attemptPlayerMove = useCallback(
    (from: string, to: string): boolean => {
      const chess = chessRef.current;
      if (isGameOver || engineThinking) return false;
      const expectedTurn = playerColor === "white" ? "w" : "b";
      if (chess.turn() !== expectedTurn) return false;
      try {
        chess.move({ from, to, promotion: "q" });
      } catch {
        return false;
      }
      setFen(chess.fen());
      if (!finishIfGameOver(chess, playerColor, engineLevel)) {
        void playEngineMoveIfNeeded(chess, playerColor, engineLevel);
      }
      return true;
    },
    [isGameOver, engineThinking, playerColor, engineLevel, finishIfGameOver, playEngineMoveIfNeeded],
  );

  const onDrop = useCallback(
    (sourceSquare: string, targetSquare: string): boolean => attemptPlayerMove(sourceSquare, targetSquare),
    [attemptPlayerMove],
  );

  // Alternative au glisser-déposer (plus fiable au clic/tap, notamment sur mobile) : un premier
  // clic sélectionne une pièce du joueur, un second tente le coup vers la case cliquée.
  const onSquareClick = useCallback(
    (square: string) => {
      if (selectedSquare) {
        const from = selectedSquare;
        setSelectedSquare(null);
        if (from !== square) attemptPlayerMove(from, square);
        return;
      }
      const expectedTurn = playerColor === "white" ? "w" : "b";
      const piece = chessRef.current.get(square as Square);
      if (piece && piece.color === expectedTurn) {
        setSelectedSquare(square);
      }
    },
    [selectedSquare, playerColor, attemptPlayerMove],
  );

  const resign = useCallback(() => {
    if (isGameOver) return;
    setIsGameOver(true);
    setResultLabel("Partie abandonnée");
    if (!savedRef.current) {
      savedRef.current = true;
      const result: ChessGameResult = playerColor === "white" ? "0-1" : "1-0";
      saveMutation.mutate({ pgn: chessRef.current.pgn(), result, playerColor, engineLevel });
    }
  }, [isGameOver, playerColor, engineLevel, saveMutation]);

  const startNewGame = useCallback(
    (color: ChessPlayerColor, level: number) => {
      const chess = new Chess();
      chessRef.current = chess;
      savedRef.current = false;
      setFen(chess.fen());
      setPlayerColor(color);
      setEngineLevel(level);
      setIsGameOver(false);
      setResultLabel(null);
      setSelectedSquare(null);
      void engineRef.current?.setSkillLevel(level);
      void playEngineMoveIfNeeded(chess, color, level);
    },
    [playEngineMoveIfNeeded],
  );

  // Dérivé directement du FEN (mis à jour de façon synchrone par setFen), pas de l'état
  // engineThinking : engineThinking ne devient true qu'à l'intérieur de la fonction async
  // playEngineMoveIfNeeded, donc un rendu intermédiaire existe entre "le joueur vient de jouer"
  // et "le moteur a commencé à réfléchir" — pendant cette fenêtre, se fier à !engineThinking
  // affiche à tort "à toi de jouer" alors que c'est déjà le tour du moteur.
  const sideToMove = fen.split(" ")[1] === "w" ? "white" : "black";
  const isPlayerTurn = !isGameOver && sideToMove === playerColor;

  return {
    fen,
    playerColor,
    engineLevel,
    isGameOver,
    resultLabel,
    engineThinking,
    isPlayerTurn,
    selectedSquare,
    onDrop,
    onSquareClick,
    resign,
    startNewGame,
  };
}
