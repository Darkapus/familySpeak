import type { GameBlockType } from "./game.js";
import type { MoveQuality, WeaknessCategory } from "./chess.js";

export type UserRole = "parent" | "child";

export interface UserDTO {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: number;
  isAiAssistant: boolean;
}

export type SignupRequestStatus = "pending" | "approved" | "rejected";

export interface SignupRequestDTO {
  id: string;
  username: string;
  displayName: string;
  status: SignupRequestStatus;
  createdAt: number;
}

export type ConversationType = "direct" | "group";

export interface ConversationDTO {
  id: string;
  type: ConversationType;
  name: string | null;
  avatarUrl: string | null;
  createdBy: string;
  createdAt: number;
  members: UserDTO[];
}

export type MessageType = "text" | "image" | "video" | "system";

export interface AttachmentDTO {
  id: string;
  messageId: string;
  filePath: string;
  thumbnailPath: string | null;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

export interface MessageDTO {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  type: MessageType;
  createdAt: number;
  editedAt: number | null;
  attachments: AttachmentDTO[];
}

export interface MessageReceiptDTO {
  messageId: string;
  userId: string;
  deliveredAt: number | null;
  readAt: number | null;
}

export interface UserProfileDTO {
  userId: string;
  profile: string | null;
  updatedAt: number | null;
}

export interface WorldBlockDTO {
  x: number;
  y: number;
  z: number;
  blockType: GameBlockType | null;
  updatedAt: number;
}

export interface GamePlayerStateDTO {
  userId: string;
  displayName: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface PlayerHomeDTO {
  userId: string;
  displayName: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

export type ChessGameSource = "live" | "chess_com";
export type ChessGameResult = "1-0" | "0-1" | "1/2-1/2" | "*";
export type ChessPlayerColor = "white" | "black";
export type ChessAnalysisStatus = "none" | "queued" | "analyzing" | "done" | "failed";

export interface ChessGameDTO {
  id: string;
  userId: string;
  source: ChessGameSource;
  chessComUsername: string | null;
  chessComGameUrl: string | null;
  pgn: string;
  result: ChessGameResult;
  playerColor: ChessPlayerColor;
  opponentName: string | null;
  timeControl: string | null;
  engineLevel: number | null;
  playedAt: number;
  analysisStatus: ChessAnalysisStatus;
  analyzedAt: number | null;
  createdAt: number;
}

export interface ChessMoveEvalDTO {
  id: string;
  gameId: string;
  ply: number;
  movedBy: ChessPlayerColor;
  fenBefore: string;
  moveSan: string;
  moveUci: string;
  bestMoveSan: string;
  bestMoveUci: string;
  evalBeforeCp: number;
  evalAfterCp: number;
  centipawnLoss: number;
  quality: MoveQuality;
  mistakeCategory: WeaknessCategory | null;
}

export interface ChessWeaknessProfileEntryDTO {
  userId: string;
  category: WeaknessCategory;
  occurrenceCount: number;
  totalCentipawnLoss: number;
  lastOccurredAt: number;
}

export interface ChessLessonDTO {
  id: string;
  userId: string;
  category: WeaknessCategory;
  title: string;
  contentMarkdown: string;
  exampleGameId: string | null;
  examplePly: number | null;
  readAt: number | null;
  generatedAt: number;
}
