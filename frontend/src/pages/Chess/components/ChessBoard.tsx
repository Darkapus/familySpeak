import { Chessboard } from "react-chessboard";
import type { ChessPlayerColor } from "@familyspeak/shared";

interface ChessBoardProps {
  fen: string;
  onDrop?: (sourceSquare: string, targetSquare: string) => boolean;
  onSquareClick?: (square: string) => void;
  selectedSquare?: string | null;
  boardOrientation: ChessPlayerColor;
  arePiecesDraggable?: boolean;
}

export function ChessBoard({
  fen,
  onDrop,
  onSquareClick,
  selectedSquare,
  boardOrientation,
  arePiecesDraggable = true,
}: ChessBoardProps) {
  return (
    <div className="mx-auto aspect-square w-full max-w-[520px]">
      <Chessboard
        position={fen}
        onPieceDrop={(source, target) => onDrop?.(source, target) ?? false}
        onSquareClick={(square) => onSquareClick?.(square)}
        customSquareStyles={selectedSquare ? { [selectedSquare]: { backgroundColor: "rgba(16, 185, 129, 0.4)" } } : {}}
        boardOrientation={boardOrientation}
        arePiecesDraggable={arePiecesDraggable}
        customBoardStyle={{ borderRadius: "12px", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}
      />
    </div>
  );
}
