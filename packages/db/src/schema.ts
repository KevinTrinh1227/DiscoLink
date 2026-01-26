import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ============================================================================
// SERVERS
// ============================================================================
export const servers = sqliteTable("servers", {
  id: text("id").primaryKey(), // Discord snowflake
  name: text("name").notNull(),
  icon: text("icon"),
  ownerId: text("owner_id").notNull(),
  memberCount: integer("member_count").default(0),
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  syncEnabled: integer("sync_enabled", { mode: "boolean" }).default(true),
  defaultConsent: text("default_consent", { enum: ["public", "anonymous", "private"] }).default(
    "public"
  ),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  lastSyncAt: integer("last_sync_at", { mode: "timestamp" }),
});

// ============================================================================
// CHANNELS
// ============================================================================
export const channels = sqliteTable(
  "channels",
  {
    id: text("id").primaryKey(), // Discord snowflake
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    parentId: text("parent_id"), // For threads, category parent
    name: text("name").notNull(),
    type: integer("type").notNull(), // Discord channel type enum
    topic: text("topic"),
    position: integer("position").default(0),
    isNsfw: integer("is_nsfw", { mode: "boolean" }).default(false),
    isSynced: integer("is_synced", { mode: "boolean" }).default(true),
    syncMode: text("sync_mode", { enum: ["full", "threads_only", "disabled"] }).default("threads_only"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
  (table) => [
    index("channels_server_id_idx").on(table.serverId),
    index("channels_deleted_at_idx").on(table.deletedAt),
  ]
);

// ============================================================================
// USERS
// ============================================================================
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // Discord snowflake
  username: text("username").notNull(),
  globalName: text("global_name"),
  discriminator: text("discriminator"),
  avatar: text("avatar"),
  banner: text("banner"),
  accentColor: integer("accent_color"),
  isBot: integer("is_bot", { mode: "boolean" }).default(false),
  flags: integer("flags"), // Discord user flags (badges)
  publicFlags: integer("public_flags"), // Public badge flags
  premiumType: integer("premium_type"), // Nitro tier (0=none, 1=classic, 2=full)
  consentStatus: text("consent_status", { enum: ["public", "anonymous", "private"] }).default(
    "public"
  ),
  consentUpdatedAt: integer("consent_updated_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ============================================================================
// TAGS (Forum tags)
// ============================================================================
export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(), // Discord snowflake
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    emoji: text("emoji"),
    isModerated: integer("is_moderated", { mode: "boolean" }).default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("tags_channel_id_idx").on(table.channelId)]
);

// ============================================================================
// THREADS
// ============================================================================
export const threads = sqliteTable(
  "threads",
  {
    id: text("id").primaryKey(), // Discord snowflake
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    status: text("status", { enum: ["open", "resolved", "locked"] }).default("open"),
    visibility: text("visibility", { enum: ["public", "private"] }).default("public"),
    isArchived: integer("is_archived", { mode: "boolean" }).default(false),
    isLocked: integer("is_locked", { mode: "boolean" }).default(false),
    isPinned: integer("is_pinned", { mode: "boolean" }).default(false),
    messageCount: integer("message_count").default(0),
    participantCount: integer("participant_count").default(0),
    autoArchiveDuration: integer("auto_archive_duration"),
    firstMessageId: text("first_message_id"),
    answerId: text("answer_id"), // For forum questions with answers
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    archivedAt: integer("archived_at", { mode: "timestamp" }),
    lastActivityAt: integer("last_activity_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
  (table) => [
    index("threads_channel_id_idx").on(table.channelId),
    index("threads_server_id_idx").on(table.serverId),
    index("threads_author_id_idx").on(table.authorId),
    index("threads_status_idx").on(table.status),
    index("threads_visibility_idx").on(table.visibility),
    index("threads_last_activity_idx").on(table.lastActivityAt),
    uniqueIndex("threads_slug_server_idx").on(table.slug, table.serverId),
    index("threads_deleted_at_idx").on(table.deletedAt),
    index("threads_is_archived_idx").on(table.isArchived),
    index("threads_is_locked_idx").on(table.isLocked),
    index("threads_is_pinned_idx").on(table.isPinned),
  ]
);

// ============================================================================
// THREAD TAGS (Junction table)
// ============================================================================
export const threadTags = sqliteTable(
  "thread_tags",
  {
    threadId: text("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex("thread_tags_unique_idx").on(table.threadId, table.tagId)]
);

// ============================================================================
// THREAD PARTICIPANTS (For private threads)
// ============================================================================
export const threadParticipants = sqliteTable(
  "thread_participants",
  {
    threadId: text("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    isBot: integer("is_bot", { mode: "boolean" }).default(false),
    messageCount: integer("message_count").default(0),
    lastMessageAt: integer("last_message_at", { mode: "timestamp" }),
    joinedAt: integer("joined_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("thread_participants_unique_idx").on(table.threadId, table.userId),
    index("thread_participants_user_id_idx").on(table.userId),
  ]
);

// ============================================================================
// MESSAGES
// ============================================================================
export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(), // Discord snowflake
    threadId: text("thread_id").references(() => threads.id, { onDelete: "cascade" }), // Nullable for non-thread channel messages
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id),
    content: text("content").notNull(),
    contentHtml: text("content_html"), // Parsed markdown
    replyToId: text("reply_to_id"), // Self-reference for replies
    isAnswer: integer("is_answer", { mode: "boolean" }).default(false),
    isPinned: integer("is_pinned", { mode: "boolean" }).default(false),
    isEdited: integer("is_edited", { mode: "boolean" }).default(false),
    editCount: integer("edit_count").default(0),
    reactionCount: integer("reaction_count").default(0),
    type: integer("type").default(0), // Discord message type
    flags: integer("flags").default(0), // Discord message flags
    // Rich content fields
    embeds: text("embeds"), // JSON array of embed objects
    components: text("components"), // JSON array of component objects
    stickers: text("stickers"), // JSON array of sticker references
    mentionedUserIds: text("mentioned_user_ids"), // JSON array of user IDs
    mentionedRoleIds: text("mentioned_role_ids"), // JSON array of role IDs
    mentionedChannelIds: text("mentioned_channel_ids"), // JSON array of channel IDs
    systemMessageType: text("system_message_type"), // System message type enum
    webhookId: text("webhook_id"), // Webhook source if applicable
    applicationId: text("application_id"), // Bot/app source if applicable
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    editedAt: integer("edited_at", { mode: "timestamp" }),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
  (table) => [
    index("messages_thread_id_idx").on(table.threadId),
    index("messages_channel_id_idx").on(table.channelId),
    index("messages_server_id_idx").on(table.serverId),
    index("messages_author_id_idx").on(table.authorId),
    index("messages_created_at_idx").on(table.createdAt),
    index("messages_is_answer_idx").on(table.isAnswer),
    index("messages_deleted_at_idx").on(table.deletedAt),
    index("messages_reply_to_idx").on(table.replyToId),
    index("messages_server_date_idx").on(table.serverId, table.createdAt),
    index("messages_thread_date_idx").on(table.threadId, table.createdAt),
  ]
);

// ============================================================================
// MESSAGE EDITS (Edit history)
// ============================================================================
export const messageEdits = sqliteTable(
  "message_edits",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    previousContent: text("previous_content").notNull(),
    editedAt: integer("edited_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("message_edits_message_id_idx").on(table.messageId)]
);

// ============================================================================
// ATTACHMENTS
// ============================================================================
export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey(), // Discord snowflake
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    url: text("url").notNull(),
    proxyUrl: text("proxy_url"),
    contentType: text("content_type"),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    isImage: integer("is_image", { mode: "boolean" }).default(false),
    isVideo: integer("is_video", { mode: "boolean" }).default(false),
    isSpoiler: integer("is_spoiler", { mode: "boolean" }).default(false),
    description: text("description"), // Alt text/description
    duration: integer("duration"), // Audio/video duration in seconds
    waveform: text("waveform"), // Audio waveform data
    attachmentFlags: integer("attachment_flags"), // Attachment flags
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("attachments_message_id_idx").on(table.messageId)]
);

// ============================================================================
// REACTIONS (Aggregated per message)
// ============================================================================
export const reactions = sqliteTable(
  "reactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(), // Unicode or custom emoji ID
    emojiName: text("emoji_name"), // Name for custom emojis
    isCustom: integer("is_custom", { mode: "boolean" }).default(false),
    isAnimated: integer("is_animated", { mode: "boolean" }).default(false), // Animated emoji support
    emojiUrl: text("emoji_url"), // CDN URL for custom emojis
    guildId: text("guild_id"), // Source guild for external emojis
    count: integer("count").default(0),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("reactions_message_emoji_idx").on(table.messageId, table.emoji),
    index("reactions_message_id_idx").on(table.messageId),
  ]
);

// ============================================================================
// MEMBER ROLES (Per server user roles)
// ============================================================================
export const memberRoles = sqliteTable(
  "member_roles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    roleId: text("role_id").notNull(),
    roleName: text("role_name"),
    roleColor: integer("role_color"),
    rolePosition: integer("role_position"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("member_roles_unique_idx").on(table.serverId, table.userId, table.roleId),
    index("member_roles_server_id_idx").on(table.serverId),
    index("member_roles_user_id_idx").on(table.userId),
  ]
);

// ============================================================================
// REACTION USERS (Individual reaction tracking)
// ============================================================================
export const reactionUsers = sqliteTable(
  "reaction_users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    reactionId: integer("reaction_id")
      .notNull()
      .references(() => reactions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    reactedAt: integer("reacted_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("reaction_users_unique_idx").on(table.reactionId, table.userId),
    index("reaction_users_reaction_id_idx").on(table.reactionId),
    index("reaction_users_user_id_idx").on(table.userId),
  ]
);

// ============================================================================
// SYNC LOG (Audit trail)
// ============================================================================
export const syncLog = sqliteTable(
  "sync_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    serverId: text("server_id").references(() => servers.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: ["initial", "incremental", "backfill", "manual"],
    }).notNull(),
    status: text("status", {
      enum: ["started", "completed", "failed"],
    }).notNull(),
    itemsSynced: integer("items_synced").default(0),
    errorMessage: text("error_message"),
    metadata: text("metadata", { mode: "json" }),
    startedAt: integer("started_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    completedAt: integer("completed_at", { mode: "timestamp" }),
  },
  (table) => [
    index("sync_log_server_id_idx").on(table.serverId),
    index("sync_log_type_idx").on(table.type),
    index("sync_log_status_idx").on(table.status),
  ]
);

// ============================================================================
// WEBHOOKS
// ============================================================================
export const webhooks = sqliteTable(
  "webhooks",
  {
    id: text("id").primaryKey(), // UUID
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    secret: text("secret").notNull(), // HMAC secret for signature verification
    events: text("events").notNull(), // JSON array: ["thread.created", "message.created"]
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    failureCount: integer("failure_count").default(0),
    lastTriggeredAt: integer("last_triggered_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("webhooks_server_id_idx").on(table.serverId),
    index("webhooks_is_active_idx").on(table.isActive),
  ]
);

// ============================================================================
// WEBHOOK DELIVERIES (Audit trail)
// ============================================================================
export const webhookDeliveries = sqliteTable(
  "webhook_deliveries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    webhookId: text("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    event: text("event").notNull(), // e.g., "thread.created", "message.created"
    payload: text("payload").notNull(), // JSON payload sent
    status: text("status", { enum: ["pending", "success", "failed"] }).notNull(),
    responseCode: integer("response_code"),
    responseBody: text("response_body"),
    attemptCount: integer("attempt_count").default(1),
    nextRetryAt: integer("next_retry_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    completedAt: integer("completed_at", { mode: "timestamp" }),
  },
  (table) => [
    index("webhook_deliveries_webhook_id_idx").on(table.webhookId),
    index("webhook_deliveries_status_idx").on(table.status),
    index("webhook_deliveries_created_at_idx").on(table.createdAt),
  ]
);

// ============================================================================
// RELATIONS
// ============================================================================
export const serversRelations = relations(servers, ({ many }) => ({
  channels: many(channels),
  threads: many(threads),
  messages: many(messages),
  syncLogs: many(syncLog),
  memberRoles: many(memberRoles),
  webhooks: many(webhooks),
}));

export const channelsRelations = relations(channels, ({ one, many }) => ({
  server: one(servers, {
    fields: [channels.serverId],
    references: [servers.id],
  }),
  threads: many(threads),
  tags: many(tags),
  messages: many(messages),
}));

export const usersRelations = relations(users, ({ many }) => ({
  threads: many(threads),
  messages: many(messages),
  threadParticipants: many(threadParticipants),
  memberRoles: many(memberRoles),
  reactionUsers: many(reactionUsers),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  channel: one(channels, {
    fields: [tags.channelId],
    references: [channels.id],
  }),
  threadTags: many(threadTags),
}));

export const threadsRelations = relations(threads, ({ one, many }) => ({
  server: one(servers, {
    fields: [threads.serverId],
    references: [servers.id],
  }),
  channel: one(channels, {
    fields: [threads.channelId],
    references: [channels.id],
  }),
  author: one(users, {
    fields: [threads.authorId],
    references: [users.id],
  }),
  messages: many(messages),
  threadTags: many(threadTags),
  participants: many(threadParticipants),
}));

export const threadTagsRelations = relations(threadTags, ({ one }) => ({
  thread: one(threads, {
    fields: [threadTags.threadId],
    references: [threads.id],
  }),
  tag: one(tags, {
    fields: [threadTags.tagId],
    references: [tags.id],
  }),
}));

export const threadParticipantsRelations = relations(threadParticipants, ({ one }) => ({
  thread: one(threads, {
    fields: [threadParticipants.threadId],
    references: [threads.id],
  }),
  user: one(users, {
    fields: [threadParticipants.userId],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  thread: one(threads, {
    fields: [messages.threadId],
    references: [threads.id],
  }),
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.id],
  }),
  server: one(servers, {
    fields: [messages.serverId],
    references: [servers.id],
  }),
  author: one(users, {
    fields: [messages.authorId],
    references: [users.id],
  }),
  replyTo: one(messages, {
    fields: [messages.replyToId],
    references: [messages.id],
  }),
  edits: many(messageEdits),
  attachments: many(attachments),
  reactions: many(reactions),
}));

export const messageEditsRelations = relations(messageEdits, ({ one }) => ({
  message: one(messages, {
    fields: [messageEdits.messageId],
    references: [messages.id],
  }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  message: one(messages, {
    fields: [attachments.messageId],
    references: [messages.id],
  }),
}));

export const reactionsRelations = relations(reactions, ({ one, many }) => ({
  message: one(messages, {
    fields: [reactions.messageId],
    references: [messages.id],
  }),
  reactionUsers: many(reactionUsers),
}));

export const memberRolesRelations = relations(memberRoles, ({ one }) => ({
  server: one(servers, {
    fields: [memberRoles.serverId],
    references: [servers.id],
  }),
  user: one(users, {
    fields: [memberRoles.userId],
    references: [users.id],
  }),
}));

export const reactionUsersRelations = relations(reactionUsers, ({ one }) => ({
  reaction: one(reactions, {
    fields: [reactionUsers.reactionId],
    references: [reactions.id],
  }),
  user: one(users, {
    fields: [reactionUsers.userId],
    references: [users.id],
  }),
}));

export const syncLogRelations = relations(syncLog, ({ one }) => ({
  server: one(servers, {
    fields: [syncLog.serverId],
    references: [servers.id],
  }),
}));

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  server: one(servers, {
    fields: [webhooks.serverId],
    references: [servers.id],
  }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  webhook: one(webhooks, {
    fields: [webhookDeliveries.webhookId],
    references: [webhooks.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================
export type Server = typeof servers.$inferSelect;
export type NewServer = typeof servers.$inferInsert;
export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type Thread = typeof threads.$inferSelect;
export type NewThread = typeof threads.$inferInsert;
export type ThreadTag = typeof threadTags.$inferSelect;
export type NewThreadTag = typeof threadTags.$inferInsert;
export type ThreadParticipant = typeof threadParticipants.$inferSelect;
export type NewThreadParticipant = typeof threadParticipants.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type MessageEdit = typeof messageEdits.$inferSelect;
export type NewMessageEdit = typeof messageEdits.$inferInsert;
export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
export type Reaction = typeof reactions.$inferSelect;
export type NewReaction = typeof reactions.$inferInsert;
export type MemberRole = typeof memberRoles.$inferSelect;
export type NewMemberRole = typeof memberRoles.$inferInsert;
export type ReactionUser = typeof reactionUsers.$inferSelect;
export type NewReactionUser = typeof reactionUsers.$inferInsert;
export type SyncLogEntry = typeof syncLog.$inferSelect;
export type NewSyncLogEntry = typeof syncLog.$inferInsert;
export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
