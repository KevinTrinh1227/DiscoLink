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
  await incrementThreadMessageCount(db, data.threadId);
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
    await decrementThreadMessageCount(db, message.threadId);
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
