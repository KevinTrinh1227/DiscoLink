import { Hono } from "hono";
import {
  getDb,
  messages,
  users,
  attachments,
  reactions,
  threads,
  eq,
  and,
  isNull,
} from "@discord-forum-api/db";
import { filterMessagesByConsent, type ConsentCheckContext } from "../lib/consent.js";

const app = new Hono();

// GET /messages/:messageId
app.get("/:messageId", async (c) => {
  const db = getDb();
  const messageId = c.req.param("messageId");

  const messageResult = await db
    .select()
    .from(messages)
    .leftJoin(users, eq(messages.authorId, users.id))
    .leftJoin(threads, eq(messages.threadId, threads.id))
    .where(and(eq(messages.id, messageId), isNull(messages.deletedAt)))
    .limit(1);

  const result = messageResult[0];

  if (!result) {
    return c.json({ error: "Message not found", code: "NOT_FOUND" }, 404);
  }

  const message = result.messages;
  const author = result.users;
  const thread = result.threads;

  // Get attachments
  const attachmentList = await db
    .select()
    .from(attachments)
    .where(eq(attachments.messageId, messageId));

  // Get reactions
  const reactionList = await db
    .select()
    .from(reactions)
    .where(eq(reactions.messageId, messageId));

  // Apply consent filtering
  const context: ConsentCheckContext = {
    requesterId: c.get("user")?.sub,
    requesterGuildIds: c.get("userGuildIds"),
    isAuthenticated: c.get("isAuthenticated"),
  };

  const filteredMessages = filterMessagesByConsent(
    [{ ...message, author }],
    message.serverId,
    context
  );

  if (filteredMessages.length === 0) {
    return c.json({ error: "Message not found", code: "NOT_FOUND" }, 404);
  }

  const filtered = filteredMessages[0]!;

  return c.json({
    id: filtered.id,
    threadId: filtered.threadId,
    content: filtered.content,
    createdAt: filtered.createdAt.toISOString(),
    editedAt: filtered.editedAt?.toISOString() ?? null,
    isEdited: filtered.isEdited,
    isAnswer: filtered.isAnswer,
    author: filtered.author
      ? {
          id: filtered.author.id,
          username: filtered.author.username,
          avatar: filtered.author.avatar,
        }
      : null,
    thread: thread
      ? {
          id: thread.id,
          title: thread.title,
          slug: thread.slug,
        }
      : null,
    attachments: attachmentList.map((a) => ({
      id: a.id,
      filename: a.filename,
      url: a.url,
      contentType: a.contentType,
      size: a.size,
      width: a.width,
      height: a.height,
    })),
    reactions: reactionList.map((r) => ({
      emoji: r.emoji,
      emojiName: r.emojiName,
      count: r.count,
      isCustom: r.isCustom,
    })),
  });
});

export default app;
