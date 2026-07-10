import { sqliteTable, text, integer, real, primaryKey, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  role: text("role", { enum: ["parent", "child"] }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
});

export const signupRequests = sqliteTable(
  "signup_requests",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
    createdAt: integer("created_at").notNull(),
    reviewedAt: integer("reviewed_at"),
    reviewedBy: text("reviewed_by").references(() => users.id),
    createdUserId: text("created_user_id").references(() => users.id),
  },
  (table) => [index("signup_requests_status_idx").on(table.status)],
);

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  type: text("type", { enum: ["direct", "group"] }).notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at").notNull(),
});

export const conversationMembers = sqliteTable(
  "conversation_members",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    joinedAt: integer("joined_at").notNull(),
    lastReadMessageId: text("last_read_message_id"),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.userId] }),
    index("conversation_members_user_id_idx").on(table.userId),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id),
    content: text("content"),
    type: text("type", { enum: ["text", "image", "video", "system"] }).notNull(),
    createdAt: integer("created_at").notNull(),
    editedAt: integer("edited_at"),
    deletedAt: integer("deleted_at"),
  },
  (table) => [index("messages_conversation_id_created_at_idx").on(table.conversationId, table.createdAt)],
);

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  messageId: text("message_id")
    .notNull()
    .references(() => messages.id),
  filePath: text("file_path").notNull(),
  thumbnailPath: text("thumbnail_path"),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  durationSeconds: real("duration_seconds"),
});

export const messageReceipts = sqliteTable(
  "message_receipts",
  {
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    deliveredAt: integer("delivered_at"),
    readAt: integer("read_at"),
  },
  (table) => [primaryKey({ columns: [table.messageId, table.userId] })],
);

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    endpoint: text("endpoint").notNull().unique(),
    keysP256dh: text("keys_p256dh").notNull(),
    keysAuth: text("keys_auth").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("push_subscriptions_user_id_idx").on(table.userId)],
);

export const hermesConversationSummaries = sqliteTable("hermes_conversation_summaries", {
  conversationId: text("conversation_id")
    .primaryKey()
    .references(() => conversations.id),
  summary: text("summary").notNull(),
  summarizedUpToCreatedAt: integer("summarized_up_to_created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const userProfiles = sqliteTable("user_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  profile: text("profile").notNull(),
  lastMessageConsideredCreatedAt: integer("last_message_considered_created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const playerHomes = sqliteTable("player_homes", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  x: real("x").notNull(),
  y: real("y").notNull(),
  z: real("z").notNull(),
  yaw: real("yaw").notNull(),
  pitch: real("pitch").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const worldBlocks = sqliteTable(
  "world_blocks",
  {
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    z: integer("z").notNull(),
    blockType: text("block_type", {
      enum: ["grass", "dirt", "stone", "wood", "sand", "red", "blue", "yellow", "water"],
    }),
    placedBy: text("placed_by").references(() => users.id),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.x, table.y, table.z] })],
);

export const refreshTokens = sqliteTable(
  "refresh_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at").notNull(),
    revokedAt: integer("revoked_at"),
  },
  (table) => [index("refresh_tokens_user_id_idx").on(table.userId)],
);
