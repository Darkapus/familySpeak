import type { GamePlayerStateDTO, MessageDTO, PlayerHomeDTO } from "./types.js";
import type { GameBlockType } from "./game.js";

/** Messages envoyés du client vers le serveur. */
export type ClientToServerEvent =
  | { type: "message:send"; payload: { conversationId: string; tempId: string; content?: string; attachmentIds?: string[] } }
  | { type: "typing:start"; payload: { conversationId: string } }
  | { type: "typing:stop"; payload: { conversationId: string } }
  | { type: "message:read"; payload: { conversationId: string; messageId: string } }
  | { type: "presence:ping"; payload: Record<string, never> }
  | { type: "game:join"; payload: Record<string, never> }
  | { type: "game:leave"; payload: Record<string, never> }
  | { type: "game:move"; payload: { x: number; y: number; z: number; yaw: number; pitch: number } }
  | { type: "game:place"; payload: { x: number; y: number; z: number; blockType: GameBlockType } }
  | { type: "game:break"; payload: { x: number; y: number; z: number } }
  | { type: "game:set-home"; payload: { x: number; y: number; z: number; yaw: number; pitch: number } };

/** Messages envoyés du serveur vers le client. */
export type ServerToClientEvent =
  | { type: "message:new"; payload: { message: MessageDTO } }
  | { type: "message:delta"; payload: { messageId: string; conversationId: string; delta: string; done: boolean } }
  | { type: "message:ack"; payload: { tempId: string; messageId: string; conversationId: string; createdAt: number } }
  | { type: "message:delivered"; payload: { messageId: string; userId: string; at: number } }
  | { type: "message:read"; payload: { messageId: string; userId: string; at: number } }
  | { type: "typing:update"; payload: { conversationId: string; userId: string; isTyping: boolean } }
  | { type: "presence:update"; payload: { userId: string; status: "online" | "offline"; lastSeenAt: number } }
  | { type: "conversation:updated"; payload: { conversationId: string } }
  | { type: "signup-request:new"; payload: { requestId: string } }
  | { type: "game:snapshot"; payload: { self: GamePlayerStateDTO; players: GamePlayerStateDTO[] } }
  | { type: "game:player-joined"; payload: GamePlayerStateDTO }
  | { type: "game:player-left"; payload: { userId: string } }
  | { type: "game:player-moved"; payload: { userId: string; x: number; y: number; z: number; yaw: number; pitch: number } }
  | { type: "game:block-changed"; payload: { x: number; y: number; z: number; blockType: GameBlockType | null } }
  | { type: "game:home-set"; payload: PlayerHomeDTO }
  | { type: "error"; payload: { message: string } };
