import { eq, and, desc, asc, isNull, sql } from "drizzle-orm";
import {
  servers,
  channels,
  users,
  tags,
  threads,
  threadTags,
  threadParticipants,
  messages,
  messageEdits,
  attachments,
  reactions,
  memberRoles,
  reactionUsers,
  syncLog,
  webhooks,
  webhookDeliveries,
  type NewServer,
  type NewChannel,
  type NewUser,
  type NewTag,
  type NewThread,
  type NewThreadParticipant,
  type NewMessage,
  type NewAttachment,
  type NewReaction,
  type NewMemberRole,
  type NewReactionUser,
  type NewSyncLogEntry,
  type NewWebhook,
  type NewWebhookDelivery,
} from "./schema.js";

// Using 'any' for db parameter to avoid union type issues
// The actual type safety comes from the schema definitions
type AnyDb = any;

// ============================================================================
// SLUG GENERATION
// ============================================================================
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^\w\s-]/g, "") // Remove non-word chars (except spaces and hyphens)
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, "") // Trim hyphens from start/end
    .slice(0, 100); // Limit length
}

export async function generateUniqueSlug(
  db: AnyDb,
  title: string,
  serverId: string
): Promise<string> {
  const baseSlug = generateSlug(title) || "thread";
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db
      .select({ id: threads.id })
      .from(threads)
      .where(and(eq(threads.slug, slug), eq(threads.serverId, serverId)))
      .limit(1);

    if (existing.length === 0) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

// ============================================================================
// SERVER HELPERS
// ============================================================================
export async function upsertServer(db: AnyDb, data: NewServer) {
  const existing = await db.select().from(servers).where(eq(servers.id, data.id)).limit(1);

  if (existing.length > 0) {
    await db
      .update(servers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(servers.id, data.id));
    return { ...existing[0], ...data };
  }

  const [inserted] = await db.insert(servers).values(data).returning();
  return inserted;
}

export async function getServerById(db: AnyDb, id: string) {
  const [server] = await db.select().from(servers).where(eq(servers.id, id)).limit(1);
  return server;
}

export async function markServerInactive(db: AnyDb, id: string) {
  await db
    .update(servers)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(servers.id, id));
}

// ============================================================================
// CHANNEL HELPERS
// ============================================================================
export async function upsertChannel(db: AnyDb, data: NewChannel) {
  const existing = await db.select().from(channels).where(eq(channels.id, data.id)).limit(1);

  if (existing.length > 0) {
    await db
      .update(channels)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(channels.id, data.id));
    return { ...existing[0], ...data };
  }

  const [inserted] = await db.insert(channels).values(data).returning();
  return inserted;
}

export async function getChannelsByServerId(db: AnyDb, serverId: string) {
  return db
    .select()
    .from(channels)
    .where(and(eq(channels.serverId, serverId), isNull(channels.deletedAt)))
    .orderBy(asc(channels.position));
}

export async function softDeleteChannel(db: AnyDb, id: string) {
  await db
    .update(channels)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(channels.id, id));
}

export async function getChannelById(db: AnyDb, id: string) {
  const [channel] = await db
    .select()
    .from(channels)
    .where(and(eq(channels.id, id), isNull(channels.deletedAt)))
    .limit(1);
  return channel;
}

// ============================================================================
// USER HELPERS
// ============================================================================
export async function upsertUser(db: AnyDb, data: NewUser) {
  const existing = await db.select().from(users).where(eq(users.id, data.id)).limit(1);

  if (existing.length > 0) {
    await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, data.id));
    return { ...existing[0], ...data };
  }

  const [inserted] = await db.insert(users).values(data).returning();
  return inserted;
}

export async function getUserById(db: AnyDb, id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
}

export async function updateUserConsent(
  db: AnyDb,
  id: string,
  consent: "public" | "anonymous" | "private"
) {
  await db
    .update(users)
    .set({
      consentStatus: consent,
      consentUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id));
}

// ============================================================================
// TAG HELPERS
// ============================================================================
export async function upsertTag(db: AnyDb, data: NewTag) {
  const existing = await db.select().from(tags).where(eq(tags.id, data.id)).limit(1);

  if (existing.length > 0) {
    await db.update(tags).set(data).where(eq(tags.id, data.id));
    return { ...existing[0], ...data };
  }

  const [inserted] = await db.insert(tags).values(data).returning();
  return inserted;
}

export async function getTagsByChannelId(db: AnyDb, channelId: string) {
  return db.select().from(tags).where(eq(tags.channelId, channelId));
}

// ============================================================================
// THREAD HELPERS
// ============================================================================
export async function createThread(db: AnyDb, data: Omit<NewThread, "slug">) {
  const slug = await generateUniqueSlug(db, data.title, data.serverId);
  const [inserted] = await db
    .insert(threads)
    .values({ ...data, slug })
    .returning();
  return inserted;
}

export async function updateThread(
  db: AnyDb,
  id: string,
  data: Partial<Omit<NewThread, "id" | "slug">>
) {
  await db.update(threads).set(data).where(eq(threads.id, id));
}

export async function getThreadById(db: AnyDb, id: string) {
  const [thread] = await db.select().from(threads).where(eq(threads.id, id)).limit(1);
  return thread;
}

export async function getThreadBySlug(db: AnyDb, serverId: string, slug: string) {
  const [thread] = await db
    .select()
    .from(threads)
    .where(and(eq(threads.serverId, serverId), eq(threads.slug, slug), isNull(threads.deletedAt)))
    .limit(1);
  return thread;
}

export async function softDeleteThread(db: AnyDb, id: string) {
  await db.update(threads).set({ deletedAt: new Date() }).where(eq(threads.id, id));
}

export async function incrementThreadMessageCount(db: AnyDb, id: string) {
  await db
    .update(threads)
    .set({
      messageCount: sql`${threads.messageCount} + 1`,
      lastActivityAt: new Date(),
    })
    .where(eq(threads.id, id));
}

export async function decrementThreadMessageCount(db: AnyDb, id: string) {
  await db
    .update(threads)
    .set({
      messageCount: sql`MAX(0, ${threads.messageCount} - 1)`,
    })
    .where(eq(threads.id, id));
}

// ============================================================================
// THREAD TAG HELPERS
// ============================================================================
export async function setThreadTags(db: AnyDb, threadId: string, tagIds: string[]) {
  await db.delete(threadTags).where(eq(threadTags.threadId, threadId));

  if (tagIds.length > 0) {
    await db.insert(threadTags).values(tagIds.map((tagId) => ({ threadId, tagId })));
  }
}

export async function getThreadTags(db: AnyDb, threadId: string) {
  return db
    .select({ tag: tags })
    .from(threadTags)
    .innerJoin(tags, eq(threadTags.tagId, tags.id))
    .where(eq(threadTags.threadId, threadId));
}

// ============================================================================
// MESSAGE HELPERS
// ============================================================================
export async function createMessage(db: AnyDb, data: NewMessage) {
  const [inserted] = await db.insert(messages).values(data).returning();
  // Only increment thread message count if this message belongs to a thread
  if (data.threadId) {
    await incrementThreadMessageCount(db, data.threadId);
  }
  return inserted;
}

export async function updateMessage(
  db: AnyDb,
  id: string,
  data: { content: string; contentHtml?: string }
) {
  const [existing] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);

  if (existing) {
    // Store edit history
    await db.insert(messageEdits).values({
      messageId: id,
      previousContent: existing.content,
      editedAt: new Date(),
    });
  }

  await db
    .update(messages)
    .set({
      ...data,
      isEdited: true,
      editCount: sql`${messages.editCount} + 1`,
      editedAt: new Date(),
    })
    .where(eq(messages.id, id));
}

export async function softDeleteMessage(db: AnyDb, id: string) {
  const [message] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);

  if (message) {
    await db.update(messages).set({ deletedAt: new Date() }).where(eq(messages.id, id));
    // Only decrement thread message count if this message belongs to a thread
    if (message.threadId) {
      await decrementThreadMessageCount(db, message.threadId);
    }
  }
}

export async function getMessageById(db: AnyDb, id: string) {
  const [message] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
  return message;
}

export async function getMessagesByThreadId(
  db: AnyDb,
  threadId: string,
  options?: { limit?: number; cursor?: string; order?: "asc" | "desc" }
) {
  const limit = options?.limit ?? 50;
  const order = options?.order ?? "asc";

  const orderFn = order === "asc" ? asc : desc;

  const results = await db
    .select()
    .from(messages)
    .where(and(eq(messages.threadId, threadId), isNull(messages.deletedAt)))
    .orderBy(orderFn(messages.createdAt))
    .limit(limit + 1);

  const hasMore = results.length > limit;
  const items = hasMore ? results.slice(0, limit) : results;
  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem ? lastItem.createdAt.toISOString() : undefined;

  return { items, hasMore, nextCursor };
}

// ============================================================================
// ATTACHMENT HELPERS
// ============================================================================
export async function createAttachments(db: AnyDb, data: NewAttachment[]) {
  if (data.length === 0) return [];
  return db.insert(attachments).values(data).returning();
}

export async function getAttachmentsByMessageId(db: AnyDb, messageId: string) {
  return db.select().from(attachments).where(eq(attachments.messageId, messageId));
}

// ============================================================================
// REACTION HELPERS
// ============================================================================
export async function upsertReaction(db: AnyDb, data: NewReaction) {
  const existing = await db
    .select()
    .from(reactions)
    .where(and(eq(reactions.messageId, data.messageId), eq(reactions.emoji, data.emoji)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(reactions)
      .set({ count: data.count, updatedAt: new Date() })
      .where(and(eq(reactions.messageId, data.messageId), eq(reactions.emoji, data.emoji)));
    return { ...existing[0], ...data };
  }

  const [inserted] = await db.insert(reactions).values(data).returning();

  // Update message reaction count
  const totalReactions = await db
    .select({ total: sql<number>`SUM(${reactions.count})` })
    .from(reactions)
    .where(eq(reactions.messageId, data.messageId));

  await db
    .update(messages)
    .set({ reactionCount: totalReactions[0]?.total ?? 0 })
    .where(eq(messages.id, data.messageId));

  return inserted;
}

export async function getReactionsByMessageId(db: AnyDb, messageId: string) {
  return db.select().from(reactions).where(eq(reactions.messageId, messageId));
}

// ============================================================================
// SYNC LOG HELPERS
// ============================================================================
export async function createSyncLog(db: AnyDb, data: NewSyncLogEntry) {
  const [inserted] = await db.insert(syncLog).values(data).returning();
  return inserted;
}

export async function updateSyncLog(
  db: AnyDb,
  id: number,
  data: Partial<Pick<NewSyncLogEntry, "status" | "itemsSynced" | "errorMessage" | "completedAt">>
) {
  await db.update(syncLog).set(data).where(eq(syncLog.id, id));
}

export async function getLatestSyncLog(db: AnyDb, serverId: string) {
  const [log] = await db
    .select()
    .from(syncLog)
    .where(eq(syncLog.serverId, serverId))
    .orderBy(desc(syncLog.startedAt))
    .limit(1);
  return log;
}

// ============================================================================
// THREAD PARTICIPANT HELPERS
// ============================================================================
export async function upsertThreadParticipant(
  db: AnyDb,
  data: NewThreadParticipant & { incrementMessageCount?: boolean }
) {
  const { incrementMessageCount, ...participantData } = data;
  const existing = await db
    .select()
    .from(threadParticipants)
    .where(
      and(
        eq(threadParticipants.threadId, participantData.threadId),
        eq(threadParticipants.userId, participantData.userId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const updateData: Record<string, unknown> = {
      ...participantData,
      lastMessageAt: participantData.lastMessageAt ?? new Date(),
    };

    if (incrementMessageCount) {
      updateData.messageCount = sql`${threadParticipants.messageCount} + 1`;
    }

    await db
      .update(threadParticipants)
      .set(updateData)
      .where(
        and(
          eq(threadParticipants.threadId, participantData.threadId),
          eq(threadParticipants.userId, participantData.userId)
        )
      );
    return { ...existing[0], ...participantData };
  }

  const [inserted] = await db
    .insert(threadParticipants)
    .values({
      ...participantData,
      messageCount: 1,
      lastMessageAt: participantData.lastMessageAt ?? new Date(),
    })
    .returning();
  return inserted;
}

export async function getThreadParticipants(db: AnyDb, threadId: string) {
  return db
    .select({
      participant: threadParticipants,
      user: users,
    })
    .from(threadParticipants)
    .leftJoin(users, eq(threadParticipants.userId, users.id))
    .where(eq(threadParticipants.threadId, threadId));
}

// ============================================================================
// MEMBER ROLE HELPERS
// ============================================================================
export async function upsertMemberRole(db: AnyDb, data: NewMemberRole) {
  const existing = await db
    .select()
    .from(memberRoles)
    .where(
      and(
        eq(memberRoles.serverId, data.serverId),
        eq(memberRoles.userId, data.userId),
        eq(memberRoles.roleId, data.roleId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(memberRoles)
      .set(data)
      .where(
        and(
          eq(memberRoles.serverId, data.serverId),
          eq(memberRoles.userId, data.userId),
          eq(memberRoles.roleId, data.roleId)
        )
      );
    return { ...existing[0], ...data };
  }

  const [inserted] = await db.insert(memberRoles).values(data).returning();
  return inserted;
}

export async function getMemberRolesByUserId(db: AnyDb, serverId: string, userId: string) {
  return db
    .select()
    .from(memberRoles)
    .where(and(eq(memberRoles.serverId, serverId), eq(memberRoles.userId, userId)))
    .orderBy(desc(memberRoles.rolePosition));
}

export async function setMemberRoles(
  db: AnyDb,
  serverId: string,
  userId: string,
  roles: Omit<NewMemberRole, "serverId" | "userId">[]
) {
  // Delete existing roles
  await db
    .delete(memberRoles)
    .where(and(eq(memberRoles.serverId, serverId), eq(memberRoles.userId, userId)));

  // Insert new roles
  if (roles.length > 0) {
    await db.insert(memberRoles).values(
      roles.map((role) => ({
        ...role,
        serverId,
        userId,
      }))
    );
  }
}

// ============================================================================
// REACTION USER HELPERS
// ============================================================================
export async function upsertReactionUser(db: AnyDb, data: NewReactionUser) {
  const existing = await db
    .select()
    .from(reactionUsers)
    .where(
      and(eq(reactionUsers.reactionId, data.reactionId), eq(reactionUsers.userId, data.userId))
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const [inserted] = await db.insert(reactionUsers).values(data).returning();
  return inserted;
}

export async function deleteReactionUser(db: AnyDb, reactionId: number, userId: string) {
  await db
    .delete(reactionUsers)
    .where(and(eq(reactionUsers.reactionId, reactionId), eq(reactionUsers.userId, userId)));
}

export async function getReactionUsersByReactionId(db: AnyDb, reactionId: number) {
  return db
    .select({
      reactionUser: reactionUsers,
      user: users,
    })
    .from(reactionUsers)
    .leftJoin(users, eq(reactionUsers.userId, users.id))
    .where(eq(reactionUsers.reactionId, reactionId));
}

export async function getReactionByMessageAndEmoji(db: AnyDb, messageId: string, emoji: string) {
  const [reaction] = await db
    .select()
    .from(reactions)
    .where(and(eq(reactions.messageId, messageId), eq(reactions.emoji, emoji)))
    .limit(1);
  return reaction;
}

// ============================================================================
// WEBHOOK HELPERS
// ============================================================================
export async function createWebhook(db: AnyDb, data: NewWebhook) {
  const [inserted] = await db.insert(webhooks).values(data).returning();
  return inserted;
}

export async function getWebhookById(db: AnyDb, id: string) {
  const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
  return webhook;
}

export async function getWebhooksByServerId(db: AnyDb, serverId: string) {
  return db
    .select()
    .from(webhooks)
    .where(eq(webhooks.serverId, serverId))
    .orderBy(desc(webhooks.createdAt));
}

export async function getActiveWebhooksByServerId(db: AnyDb, serverId: string) {
  return db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.serverId, serverId), eq(webhooks.isActive, true)));
}

export async function updateWebhook(
  db: AnyDb,
  id: string,
  data: Partial<Omit<NewWebhook, "id" | "createdAt">>
) {
  await db
    .update(webhooks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(webhooks.id, id));
}

export async function deleteWebhook(db: AnyDb, id: string) {
  await db.delete(webhooks).where(eq(webhooks.id, id));
}

export async function incrementWebhookFailureCount(db: AnyDb, id: string) {
  await db
    .update(webhooks)
    .set({
      failureCount: sql`${webhooks.failureCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(webhooks.id, id));
}

export async function resetWebhookFailureCount(db: AnyDb, id: string) {
  await db
    .update(webhooks)
    .set({
      failureCount: 0,
      lastTriggeredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(webhooks.id, id));
}

export async function disableWebhook(db: AnyDb, id: string) {
  await db
    .update(webhooks)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(webhooks.id, id));
}

// ============================================================================
// WEBHOOK DELIVERY HELPERS
// ============================================================================
export async function createWebhookDelivery(db: AnyDb, data: NewWebhookDelivery) {
  const [inserted] = await db.insert(webhookDeliveries).values(data).returning();
  return inserted;
}

export async function updateWebhookDelivery(
  db: AnyDb,
  id: number,
  data: Partial<Pick<NewWebhookDelivery, "status" | "responseCode" | "responseBody" | "attemptCount" | "nextRetryAt" | "completedAt">>
) {
  await db.update(webhookDeliveries).set(data).where(eq(webhookDeliveries.id, id));
}

export async function getWebhookDeliveriesByWebhookId(db: AnyDb, webhookId: string, limit = 50) {
  return db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, webhookId))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit);
}

export async function getPendingWebhookDeliveries(db: AnyDb) {
  return db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.status, "pending"))
    .orderBy(asc(webhookDeliveries.createdAt));
}

// ============================================================================
// WEBHOOK DEAD LETTER HELPERS
// ============================================================================

import {
  webhookDeadLetters,
  type NewWebhookDeadLetter,
  polls,
  pollAnswers,
  pollVotes,
  scheduledEvents,
  type NewPoll,
  type NewPollAnswer,
  type NewPollVote,
  type NewScheduledEvent,
} from "./schema.js";

export async function createWebhookDeadLetter(db: AnyDb, data: NewWebhookDeadLetter) {
  const [inserted] = await db.insert(webhookDeadLetters).values(data).returning();
  return inserted;
}

export async function getWebhookDeadLettersByWebhookId(db: AnyDb, webhookId: string, limit = 50) {
  return db
    .select()
    .from(webhookDeadLetters)
    .where(eq(webhookDeadLetters.webhookId, webhookId))
    .orderBy(desc(webhookDeadLetters.failedAt))
    .limit(limit);
}

export async function getUnreplayedDeadLetters(db: AnyDb, limit = 100) {
  return db
    .select()
    .from(webhookDeadLetters)
    .where(isNull(webhookDeadLetters.replayedAt))
    .orderBy(asc(webhookDeadLetters.failedAt))
    .limit(limit);
}

export async function markDeadLetterReplayed(
  db: AnyDb,
  id: number,
  replayedBy?: string
) {
  await db
    .update(webhookDeadLetters)
    .set({
      replayedAt: new Date(),
      replayedBy: replayedBy ?? null,
    })
    .where(eq(webhookDeadLetters.id, id));
}

export async function deleteOldDeadLetters(db: AnyDb, olderThanDays = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  await db
    .delete(webhookDeadLetters)
    .where(
      and(
        sql`${webhookDeadLetters.failedAt} < ${cutoff.getTime()}`,
        sql`${webhookDeadLetters.replayedAt} IS NOT NULL`
      )
    );
}

// ============================================================================
// POLL HELPERS
// ============================================================================
export async function upsertPoll(db: AnyDb, data: NewPoll) {
  const existing = await db.select().from(polls).where(eq(polls.id, data.id)).limit(1);

  if (existing.length > 0) {
    await db
      .update(polls)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(polls.id, data.id));
    return { ...existing[0], ...data };
  }

  const [inserted] = await db.insert(polls).values(data).returning();
  return inserted;
}

export async function getPollByMessageId(db: AnyDb, messageId: string) {
  const [poll] = await db.select().from(polls).where(eq(polls.messageId, messageId)).limit(1);
  return poll;
}

export async function upsertPollAnswer(db: AnyDb, data: NewPollAnswer) {
  const existing = await db
    .select()
    .from(pollAnswers)
    .where(and(eq(pollAnswers.pollId, data.pollId), eq(pollAnswers.answerId, data.answerId)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(pollAnswers)
      .set(data)
      .where(and(eq(pollAnswers.pollId, data.pollId), eq(pollAnswers.answerId, data.answerId)));
    return { ...existing[0], ...data };
  }

  const [inserted] = await db.insert(pollAnswers).values(data).returning();
  return inserted;
}

export async function getPollAnswers(db: AnyDb, pollId: string) {
  return db.select().from(pollAnswers).where(eq(pollAnswers.pollId, pollId));
}

export async function addPollVote(db: AnyDb, data: NewPollVote) {
  const existing = await db
    .select()
    .from(pollVotes)
    .where(
      and(
        eq(pollVotes.pollId, data.pollId),
        eq(pollVotes.answerId, data.answerId),
        eq(pollVotes.userId, data.userId)
      )
    )
    .limit(1);

  if (existing.length > 0) return existing[0];

  const [inserted] = await db.insert(pollVotes).values(data).returning();

  // Increment vote count
  await db
    .update(pollAnswers)
    .set({ voteCount: sql`${pollAnswers.voteCount} + 1` })
    .where(and(eq(pollAnswers.pollId, data.pollId), eq(pollAnswers.answerId, data.answerId)));

  return inserted;
}

export async function removePollVote(db: AnyDb, pollId: string, answerId: number, userId: string) {
  await db
    .delete(pollVotes)
    .where(
      and(
        eq(pollVotes.pollId, pollId),
        eq(pollVotes.answerId, answerId),
        eq(pollVotes.userId, userId)
      )
    );

  // Decrement vote count
  await db
    .update(pollAnswers)
    .set({ voteCount: sql`MAX(0, ${pollAnswers.voteCount} - 1)` })
    .where(and(eq(pollAnswers.pollId, pollId), eq(pollAnswers.answerId, answerId)));
}

// ============================================================================
// SCHEDULED EVENT HELPERS
// ============================================================================
export async function upsertScheduledEvent(db: AnyDb, data: NewScheduledEvent) {
  const existing = await db
    .select()
    .from(scheduledEvents)
    .where(eq(scheduledEvents.id, data.id))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(scheduledEvents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(scheduledEvents.id, data.id));
    return { ...existing[0], ...data };
  }

  const [inserted] = await db.insert(scheduledEvents).values(data).returning();
  return inserted;
}

export async function getScheduledEventsByServerId(db: AnyDb, serverId: string) {
  return db
    .select()
    .from(scheduledEvents)
    .where(eq(scheduledEvents.serverId, serverId))
    .orderBy(asc(scheduledEvents.scheduledStartTime));
}

export async function deleteScheduledEvent(db: AnyDb, id: string) {
  await db.delete(scheduledEvents).where(eq(scheduledEvents.id, id));
}
