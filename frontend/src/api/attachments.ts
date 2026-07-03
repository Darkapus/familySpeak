import type { MessageDTO } from "@familyspeak/shared";
import { api, authenticatedMediaUrl } from "./client.js";

export function uploadAttachment(conversationId: string, file: File) {
  return api.upload<{ message: MessageDTO }>(`/conversations/${conversationId}/attachments`, file);
}

export function attachmentFileUrl(attachmentId: string): string {
  return authenticatedMediaUrl(`/attachments/${attachmentId}/file`);
}

export function attachmentThumbnailUrl(attachmentId: string): string {
  return authenticatedMediaUrl(`/attachments/${attachmentId}/thumbnail`);
}
