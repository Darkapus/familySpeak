import { createReadStream } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../config/env.js";
import { broadcastToUsers } from "../../ws/registry.js";
import { requireAuth } from "../auth/guard.js";
import { getConversationWithMembers, isMember } from "../conversations/repository.js";
import { createMediaMessage, findMessageById } from "../messages/repository.js";
import { notifyOfflineMembers } from "../push/notify.js";
import {
  generateImageThumbnail,
  generateVideoThumbnail,
  isAllowedMimeType,
  isImage,
  isVideo,
  maxSizeForMimeType,
  saveUploadedFile,
} from "./media-processing.js";
import { findAttachmentWithConversation, insertAttachment } from "./repository.js";

export async function registerAttachmentUploadRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string } }>("/:id/attachments", { preHandler: requireAuth }, async (request, reply) => {
    const conversation = getConversationWithMembers(request.params.id);
    if (!conversation) {
      return reply.code(404).send({ error: "Conversation introuvable" });
    }
    if (!isMember(conversation.id, request.user.sub)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: "Fichier requis" });
    }
    if (!isAllowedMimeType(data.mimetype)) {
      return reply.code(400).send({ error: "Type de fichier non autorisé" });
    }

    const { relativePath, absolutePath } = await saveUploadedFile(data.file, data.mimetype);

    if (data.file.truncated) {
      await unlink(absolutePath).catch(() => {});
      return reply.code(400).send({ error: "Fichier trop volumineux" });
    }

    const stats = await stat(absolutePath);
    if (stats.size > maxSizeForMimeType(data.mimetype)) {
      await unlink(absolutePath).catch(() => {});
      return reply.code(400).send({ error: "Fichier trop volumineux" });
    }

    let thumbnailRelativePath: string | null = null;
    let width: number | null = null;
    let height: number | null = null;
    let durationSeconds: number | null = null;

    if (isImage(data.mimetype)) {
      const result = await generateImageThumbnail(absolutePath, relativePath);
      thumbnailRelativePath = result.thumbnailRelativePath;
      width = result.width;
      height = result.height;
    } else if (isVideo(data.mimetype)) {
      const result = await generateVideoThumbnail(absolutePath, relativePath);
      thumbnailRelativePath = result.thumbnailRelativePath;
      width = result.width;
      height = result.height;
      durationSeconds = result.durationSeconds;
    }

    const messageType = isImage(data.mimetype) ? "image" : "video";
    const message = createMediaMessage({
      conversationId: conversation.id,
      senderId: request.user.sub,
      content: null,
      type: messageType,
    });

    insertAttachment({
      messageId: message.id,
      filePath: relativePath,
      thumbnailPath: thumbnailRelativePath,
      mimeType: data.mimetype,
      sizeBytes: stats.size,
      width,
      height,
      durationSeconds,
    });

    const fullMessage = findMessageById(message.id)!;
    broadcastToUsers(
      conversation.members.map((m) => m.id),
      { type: "message:new", payload: { message: fullMessage } },
    );
    notifyOfflineMembers(conversation, fullMessage);

    return reply.code(201).send({ message: fullMessage });
  });
}

function createAuthGuard(app: FastifyInstance) {
  return async function requireAuthViaHeaderOrQuery(
    request: FastifyRequest<{ Querystring: { token?: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const queryToken = request.query.token;
    if (!queryToken) {
      return requireAuth(request, reply);
    }
    try {
      request.user = app.jwt.verify(queryToken);
    } catch {
      reply.code(401).send({ error: "unauthorized" });
    }
  };
}

export async function registerAttachmentFileRoutes(app: FastifyInstance) {
  const authGuard = createAuthGuard(app);

  app.get<{ Params: { attachmentId: string }; Querystring: { token?: string } }>(
    "/:attachmentId/file",
    { preHandler: authGuard },
    async (request, reply) => {
      const attachment = findAttachmentWithConversation(request.params.attachmentId);
      if (!attachment) {
        return reply.code(404).send({ error: "Introuvable" });
      }
      if (!isMember(attachment.conversationId, request.user.sub)) {
        return reply.code(403).send({ error: "forbidden" });
      }
      reply.type(attachment.mimeType);
      return reply.send(createReadStream(join(env.mediaDir, attachment.filePath)));
    },
  );

  app.get<{ Params: { attachmentId: string }; Querystring: { token?: string } }>(
    "/:attachmentId/thumbnail",
    { preHandler: authGuard },
    async (request, reply) => {
      const attachment = findAttachmentWithConversation(request.params.attachmentId);
      if (!attachment) {
        return reply.code(404).send({ error: "Introuvable" });
      }
      if (!isMember(attachment.conversationId, request.user.sub)) {
        return reply.code(403).send({ error: "forbidden" });
      }
      if (!attachment.thumbnailPath) {
        return reply.code(404).send({ error: "Pas de miniature" });
      }
      reply.type(attachment.thumbnailPath.endsWith(".jpg") ? "image/jpeg" : "image/webp");
      return reply.send(createReadStream(join(env.mediaDir, attachment.thumbnailPath)));
    },
  );
}
