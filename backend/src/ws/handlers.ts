import type { WebSocket } from "@fastify/websocket";
import {
  isGameBlockType,
  isWithinGameWorldBounds,
  isWithinGameWorldBoundsContinuous,
  type ClientToServerEvent,
} from "@familyspeak/shared";
import { env } from "../config/env.js";
import { getConversationWithMembers, isMember } from "../modules/conversations/repository.js";
import { createTextMessage, findMessageById, markMessageRead } from "../modules/messages/repository.js";
import { notifyOfflineMembers } from "../modules/push/notify.js";
import { triggerHermesAutoReply } from "../modules/hermes/autoReply.js";
import { findUserById, listUsers } from "../modules/users/repository.js";
import { playerJoin, playerLeave, queueMove } from "../modules/game/liveState.js";
import { upsertWorldBlock } from "../modules/game/repository.js";
import { broadcastToUsers, sendToUser } from "./registry.js";

function otherUserIds(excludeUserId: string): string[] {
  return listUsers()
    .map((u) => u.id)
    .filter((id) => id !== excludeUserId);
}

function sendError(socket: WebSocket, message: string): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify({ type: "error", payload: { message } }));
  }
}

export function handleClientMessage(userId: string, socket: WebSocket, raw: string): void {
  let event: ClientToServerEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    sendError(socket, "Message JSON invalide");
    return;
  }

  try {
    handleEvent(userId, socket, event);
  } catch (err) {
    // Ne jamais laisser une erreur sur un message d'un client faire tomber tout le process
    // (et donc déconnecter toute la famille) : on l'isole ici.
    console.error("Erreur en traitant un message WebSocket:", err);
    sendError(socket, "Erreur serveur");
  }
}

function handleEvent(userId: string, socket: WebSocket, event: ClientToServerEvent): void {
  switch (event.type) {
    case "message:send": {
      const { conversationId, tempId, content } = event.payload;
      const conversation = getConversationWithMembers(conversationId);
      if (!conversation || !isMember(conversationId, userId)) {
        sendError(socket, "Conversation introuvable ou accès refusé");
        return;
      }
      const trimmed = content?.trim();
      if (!trimmed) {
        sendError(socket, "content requis");
        return;
      }

      const message = createTextMessage({ conversationId, senderId: userId, content: trimmed });

      // L'accusé (message:ack) doit arriver avant la diffusion (message:new) sur la connexion
      // de l'expéditeur : le client s'en sert pour transformer son message optimiste (tempId)
      // en message définitif. S'il arrivait après, le client ne reconnaîtrait pas encore son
      // propre message dans la diffusion et l'ajouterait en double.
      sendToUser(userId, {
        type: "message:ack",
        payload: { tempId, messageId: message.id, conversationId, createdAt: message.createdAt },
      });
      broadcastToUsers(
        conversation.members.map((m) => m.id),
        { type: "message:new", payload: { message } },
      );
      notifyOfflineMembers(conversation, message);
      triggerHermesAutoReply(conversation, message);
      return;
    }
    case "typing:start":
    case "typing:stop": {
      const { conversationId } = event.payload;
      const conversation = getConversationWithMembers(conversationId);
      if (!conversation || !isMember(conversationId, userId)) return;

      const isTyping = event.type === "typing:start";
      const otherMemberIds = conversation.members.map((m) => m.id).filter((id) => id !== userId);
      broadcastToUsers(otherMemberIds, { type: "typing:update", payload: { conversationId, userId, isTyping } });
      return;
    }
    case "message:read": {
      const { conversationId, messageId } = event.payload;
      const conversation = getConversationWithMembers(conversationId);
      if (!conversation || !isMember(conversationId, userId)) return;
      if (!findMessageById(messageId)) return;

      markMessageRead(conversationId, messageId, userId);
      const otherMemberIds = conversation.members.map((m) => m.id).filter((id) => id !== userId);
      broadcastToUsers(otherMemberIds, { type: "message:read", payload: { messageId, userId, at: Date.now() } });
      return;
    }
    case "presence:ping":
      return;
    case "game:join": {
      if (!env.gameEnabled) {
        sendError(socket, "Jeu désactivé");
        return;
      }
      const user = findUserById(userId);
      if (!user) return;
      const { self, others } = playerJoin(userId, user.displayName);
      sendToUser(userId, { type: "game:snapshot", payload: { players: others } });
      broadcastToUsers(otherUserIds(userId), { type: "game:player-joined", payload: self });
      return;
    }
    case "game:leave": {
      if (!env.gameEnabled) return;
      if (playerLeave(userId)) {
        broadcastToUsers(otherUserIds(userId), { type: "game:player-left", payload: { userId } });
      }
      return;
    }
    case "game:move": {
      if (!env.gameEnabled) return;
      const { x, y, z, yaw, pitch } = event.payload;
      if (!isWithinGameWorldBoundsContinuous(x, y, z)) return;
      queueMove(userId, { x, y, z, yaw, pitch });
      return;
    }
    case "game:place": {
      if (!env.gameEnabled) {
        sendError(socket, "Jeu désactivé");
        return;
      }
      const { x, y, z, blockType } = event.payload;
      if (!isWithinGameWorldBounds(x, y, z) || !isGameBlockType(blockType)) {
        sendError(socket, "Placement de bloc invalide");
        return;
      }
      upsertWorldBlock(x, y, z, blockType, userId);
      broadcastToUsers(
        listUsers().map((u) => u.id),
        { type: "game:block-changed", payload: { x, y, z, blockType } },
      );
      return;
    }
    case "game:break": {
      if (!env.gameEnabled) {
        sendError(socket, "Jeu désactivé");
        return;
      }
      const { x, y, z } = event.payload;
      if (!isWithinGameWorldBounds(x, y, z)) {
        sendError(socket, "Case invalide");
        return;
      }
      upsertWorldBlock(x, y, z, null, userId);
      broadcastToUsers(
        listUsers().map((u) => u.id),
        { type: "game:block-changed", payload: { x, y, z, blockType: null } },
      );
      return;
    }
    default:
      return;
  }
}

/** Appelé par le plugin WS à la fermeture d'une connexion, pour couvrir les déconnexions brutales
 * (onglet tué...) qu'un `game:leave` envoyé par le client peut manquer. */
export function handleGameDisconnect(userId: string): void {
  if (!env.gameEnabled) return;
  if (playerLeave(userId)) {
    broadcastToUsers(otherUserIds(userId), { type: "game:player-left", payload: { userId } });
  }
}
