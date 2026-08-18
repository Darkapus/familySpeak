import type {
  ChessGameDTO,
  ChessGameResult,
  ChessLessonDTO,
  ChessMoveEvalDTO,
  ChessPlayerColor,
  ChessProgressPointDTO,
  ChessPuzzleDTO,
  ChessWeaknessProfileEntryDTO,
} from "@familyspeak/shared";
import { api } from "./client.js";

export function fetchChessGames(options: { before?: number; userId?: string } = {}) {
  const params = new URLSearchParams();
  if (options.before !== undefined) params.set("before", String(options.before));
  if (options.userId) params.set("userId", options.userId);
  const query = params.toString();
  return api.get<{ games: ChessGameDTO[]; nextBefore: number | null }>(`/chess/games${query ? `?${query}` : ""}`);
}

export function fetchChessGame(gameId: string) {
  return api.get<{ game: ChessGameDTO }>(`/chess/games/${gameId}`);
}

export function fetchChessGameAnalysis(gameId: string) {
  return api.get<{ moves: ChessMoveEvalDTO[] }>(`/chess/games/${gameId}/analysis`);
}

export function reanalyzeChessGame(gameId: string) {
  return api.post<{ ok: true }>(`/chess/games/${gameId}/reanalyze`);
}

export function saveChessGame(input: {
  pgn: string;
  result: ChessGameResult;
  playerColor: ChessPlayerColor;
  engineLevel: number;
}) {
  return api.post<{ game: ChessGameDTO }>("/chess/games", input);
}

export function importChessComGames(username: string) {
  return api.post<{ importedCount: number; skippedCount: number }>("/chess/import", { username });
}

export function fetchChessWeaknessProfile(userId?: string) {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  return api.get<{ profile: ChessWeaknessProfileEntryDTO[] }>(`/chess/weakness-profile${query}`);
}

export function fetchChessLessons(userId?: string) {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  return api.get<{ lessons: ChessLessonDTO[] }>(`/chess/lessons${query}`);
}

export function markChessLessonRead(lessonId: string) {
  return api.post<{ ok: true }>(`/chess/lessons/${lessonId}/read`);
}

export function fetchChessProgress(userId?: string) {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  return api.get<{ points: ChessProgressPointDTO[] }>(`/chess/progress${query}`);
}

export function fetchChessPuzzles(limit = 10) {
  return api.get<{ puzzles: ChessPuzzleDTO[] }>(`/chess/puzzles?limit=${limit}`);
}

export function askChessPositionChat(input: {
  fen: string;
  question: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  return api.post<{ reply: string }>("/chess/chat", input);
}
