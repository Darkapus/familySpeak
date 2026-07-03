import type { WebSocket } from "@fastify/websocket";
import type { ClientToServerEvent } from "@familyspeak/shared";
import { getConversationWithMembers, isMember } from "../modules/conversations/repository.js";
import { createTextMessage, findMessageById, markMessageRead } from "../modules/messages/repository.js";
import { notifyOfflineMembers } from "../modules/push/notify.js";
import { broadcastToUsers, sendToUser } from "./registry.js";

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
    default:
      return;
  }
}
