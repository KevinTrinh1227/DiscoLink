// Schema exports
export * from "./schema.js";

// Client exports
export {
  createDbClient,
  createD1Client,
  getDb,
  setDb,
  resetDb,
  getDbConfigFromEnv,
  dbConfigSchema,
  type DbConfig,
  type DbClient,
  type SqliteConfig,
  type TursoConfig,
} from "./client.js";

// Helper exports
export {
  generateSlug,
  generateUniqueSlug,
  upsertServer,
  getServerById,
  markServerInactive,
  upsertChannel,
  getChannelsByServerId,
  getChannelById,
  softDeleteChannel,
  upsertUser,
  getUserById,
  updateUserConsent,
  upsertTag,
  getTagsByChannelId,
  createThread,
  updateThread,
  getThreadById,
  getThreadBySlug,
  softDeleteThread,
  incrementThreadMessageCount,
  decrementThreadMessageCount,
  setThreadTags,
  getThreadTags,
  createMessage,
  updateMessage,
  softDeleteMessage,
  getMessageById,
  getMessagesByThreadId,
  createAttachments,
  getAttachmentsByMessageId,
  upsertReaction,
  getReactionsByMessageId,
  createSyncLog,
  updateSyncLog,
  getLatestSyncLog,
  // Thread participant helpers
  upsertThreadParticipant,
  getThreadParticipants,
  // Member role helpers
  upsertMemberRole,
  getMemberRolesByUserId,
  setMemberRoles,
  // Reaction user helpers
  upsertReactionUser,
  deleteReactionUser,
  getReactionUsersByReactionId,
  getReactionByMessageAndEmoji,
  // Webhook helpers
  createWebhook,
  getWebhookById,
  getWebhooksByServerId,
  getActiveWebhooksByServerId,
  updateWebhook,
  deleteWebhook,
  incrementWebhookFailureCount,
  resetWebhookFailureCount,
  disableWebhook,
  // Webhook delivery helpers
  createWebhookDelivery,
  updateWebhookDelivery,
  getWebhookDeliveriesByWebhookId,
  getPendingWebhookDeliveries,
  // Webhook dead letter helpers
  createWebhookDeadLetter,
  getWebhookDeadLettersByWebhookId,
  getUnreplayedDeadLetters,
  markDeadLetterReplayed,
  deleteOldDeadLetters,
} from "./helpers.js";

// Re-export drizzle utilities for convenience
export { eq, and, or, desc, asc, isNull, sql, like, gt, lt, gte, lte, ne, inArray } from "drizzle-orm";
