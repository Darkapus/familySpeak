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
