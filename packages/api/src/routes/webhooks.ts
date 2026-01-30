import { Hono } from "hono";
import { z } from "zod";
import { randomBytes, createHmac } from "crypto";
import {
  getDb,
  servers,
  createWebhook,
  getWebhookById,
  getWebhooksByServerId,
  updateWebhook,
  deleteWebhook,
  getWebhookDeliveriesByWebhookId,
  getWebhookDeadLettersByWebhookId,
  markDeadLetterReplayed,
  createWebhookDelivery,
  updateWebhookDelivery,
  eq,
  and,
} from "@discolink/db";
import { requireAuth } from "../middleware/auth.js";

/**
 * Validate that a webhook URL does not point to a private/internal IP address.
 * Blocks: 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, ::1
 */
function isPrivateUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    const hostname = url.hostname;

    // Block IPv6 loopback
    if (hostname === "::1" || hostname === "[::1]") return true;

    // Block localhost
    if (hostname === "localhost") return true;

    // Block private IPv4 ranges
    const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipv4Match) {
      const parts = ipv4Match.map(Number);
      const a = parts[1]!;
      const b = parts[2]!;
      if (a === 127) return true;                          // 127.0.0.0/8
      if (a === 10) return true;                           // 10.0.0.0/8
      if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
      if (a === 192 && b === 168) return true;             // 192.168.0.0/16
      if (a === 169 && b === 254) return true;             // 169.254.0.0/16
    }

    return false;
  } catch {
    return true; // Invalid URL = block
  }
}

const app = new Hono();

// Webhook event types
const VALID_EVENTS = [
  "thread.created",
  "thread.updated",
  "thread.deleted",
  "thread.resolved",
  "message.created",
  "message.updated",
  "message.deleted",
  "reaction.added",
  "reaction.removed",
  "sync.completed",
] as const;

const createWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  events: z.array(z.enum(VALID_EVENTS)).min(1),
});

const updateWebhookSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  events: z.array(z.enum(VALID_EVENTS)).min(1).optional(),
  isActive: z.boolean().optional(),
});

// Generate webhook ID
function generateWebhookId(): string {
  return `wh_${randomBytes(16).toString("hex")}`;
}

// Generate webhook secret for HMAC signing
function generateWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString("hex")}`;
}

// POST /webhooks/servers/:serverId - Create a new webhook
app.post("/servers/:serverId", requireAuth, async (c) => {
  const db = getDb();
  const serverId = c.req.param("serverId");

  // Parse request body
  const body = await c.req.json();
  const result = createWebhookSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: "Invalid request body", code: "VALIDATION_ERROR", details: result.error.errors },
      400
    );
  }

  // Verify server exists
  const serverResult = await db
    .select()
    .from(servers)
    .where(and(eq(servers.id, serverId), eq(servers.isActive, true)))
    .limit(1);

  if (serverResult.length === 0) {
    return c.json({ error: "Server not found", code: "NOT_FOUND" }, 404);
  }

  const { name, url, events } = result.data;

  // Validate URL is not pointing to private/internal IPs
  if (isPrivateUrl(url)) {
    return c.json(
      { error: "Webhook URL must not point to a private or internal network address", code: "VALIDATION_ERROR" },
      400
    );
  }

  // Create the webhook
  const webhook = await createWebhook(db, {
    id: generateWebhookId(),
    serverId,
    name,
    url,
    secret: generateWebhookSecret(),
    events: JSON.stringify(events),
    isActive: true,
    failureCount: 0,
  });

  return c.json({
    id: webhook.id,
    serverId: webhook.serverId,
    name: webhook.name,
    url: webhook.url,
    secret: webhook.secret, // Only shown on creation
    events: JSON.parse(webhook.events),
    isActive: webhook.isActive,
    createdAt: webhook.createdAt.toISOString(),
  }, 201);
});

// GET /webhooks/servers/:serverId - List webhooks for a server
app.get("/servers/:serverId", requireAuth, async (c) => {
  const db = getDb();
  const serverId = c.req.param("serverId");

  // Verify server exists
  const serverResult = await db
    .select()
    .from(servers)
    .where(and(eq(servers.id, serverId), eq(servers.isActive, true)))
    .limit(1);

  if (serverResult.length === 0) {
    return c.json({ error: "Server not found", code: "NOT_FOUND" }, 404);
  }

  const webhookList = await getWebhooksByServerId(db, serverId);

  return c.json({
    webhooks: webhookList.map((wh: any) => ({
      id: wh.id,
      name: wh.name,
      url: wh.url,
      events: JSON.parse(wh.events),
      isActive: wh.isActive,
      failureCount: wh.failureCount,
      lastTriggeredAt: wh.lastTriggeredAt?.toISOString() ?? null,
      createdAt: wh.createdAt.toISOString(),
      updatedAt: wh.updatedAt.toISOString(),
    })),
  });
});

// GET /webhooks/:webhookId - Get a specific webhook
app.get("/:webhookId", requireAuth, async (c) => {
  const db = getDb();
  const webhookId = c.req.param("webhookId");

  const webhook = await getWebhookById(db, webhookId);

  if (!webhook) {
    return c.json({ error: "Webhook not found", code: "NOT_FOUND" }, 404);
  }

  return c.json({
    id: webhook.id,
    serverId: webhook.serverId,
    name: webhook.name,
    url: webhook.url,
    events: JSON.parse(webhook.events),
    isActive: webhook.isActive,
    failureCount: webhook.failureCount,
    lastTriggeredAt: webhook.lastTriggeredAt?.toISOString() ?? null,
    createdAt: webhook.createdAt.toISOString(),
    updatedAt: webhook.updatedAt.toISOString(),
  });
});

// PUT /webhooks/:webhookId - Update a webhook
app.put("/:webhookId", requireAuth, async (c) => {
  const db = getDb();
  const webhookId = c.req.param("webhookId");

  const webhook = await getWebhookById(db, webhookId);

  if (!webhook) {
    return c.json({ error: "Webhook not found", code: "NOT_FOUND" }, 404);
  }

  const body = await c.req.json();
  const result = updateWebhookSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: "Invalid request body", code: "VALIDATION_ERROR", details: result.error.errors },
      400
    );
  }

  // Validate URL if being updated
  if (result.data.url !== undefined && isPrivateUrl(result.data.url)) {
    return c.json(
      { error: "Webhook URL must not point to a private or internal network address", code: "VALIDATION_ERROR" },
      400
    );
  }

  const updateData: Record<string, unknown> = {};
  if (result.data.name !== undefined) updateData.name = result.data.name;
  if (result.data.url !== undefined) updateData.url = result.data.url;
  if (result.data.events !== undefined) updateData.events = JSON.stringify(result.data.events);
  if (result.data.isActive !== undefined) updateData.isActive = result.data.isActive;

  await updateWebhook(db, webhookId, updateData);

  const updated = await getWebhookById(db, webhookId);

  return c.json({
    id: updated!.id,
    serverId: updated!.serverId,
    name: updated!.name,
    url: updated!.url,
    events: JSON.parse(updated!.events),
    isActive: updated!.isActive,
    failureCount: updated!.failureCount,
    lastTriggeredAt: updated!.lastTriggeredAt?.toISOString() ?? null,
    createdAt: updated!.createdAt.toISOString(),
    updatedAt: updated!.updatedAt.toISOString(),
  });
});

// DELETE /webhooks/:webhookId - Delete a webhook
app.delete("/:webhookId", requireAuth, async (c) => {
  const db = getDb();
  const webhookId = c.req.param("webhookId");

  const webhook = await getWebhookById(db, webhookId);

  if (!webhook) {
    return c.json({ error: "Webhook not found", code: "NOT_FOUND" }, 404);
  }

  await deleteWebhook(db, webhookId);

  return c.json({ success: true });
});

// POST /webhooks/:webhookId/test - Send a test payload
app.post("/:webhookId/test", requireAuth, async (c) => {
  const db = getDb();
  const webhookId = c.req.param("webhookId");

  const webhook = await getWebhookById(db, webhookId);

  if (!webhook) {
    return c.json({ error: "Webhook not found", code: "NOT_FOUND" }, 404);
  }

  // Create test payload
  const testPayload = {
    event: "test" as const,
    timestamp: new Date().toISOString(),
    serverId: webhook.serverId,
    data: {
      message: "This is a test webhook delivery from DiscoLink",
    },
  };

  const payloadStr = JSON.stringify(testPayload);
  const signature = createHmac("sha256", webhook.secret).update(payloadStr).digest("hex");

  // Create delivery record
  const delivery = await createWebhookDelivery(db, {
    webhookId: webhook.id,
    event: "test",
    payload: payloadStr,
    status: "pending",
    attemptCount: 1,
  });

  // Actually send the webhook
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-DiscoLink-Signature": `sha256=${signature}`,
        "X-DiscoLink-Event": "test",
        "X-DiscoLink-Delivery": `test-${Date.now()}`,
      },
      body: payloadStr,
      signal: controller.signal,
    });

    await updateWebhookDelivery(db, delivery.id, {
      status: response.ok ? "success" : "failed",
      responseCode: response.status,
      attemptCount: 1,
      completedAt: new Date(),
    });

    return c.json({
      message: response.ok ? "Test webhook delivered successfully" : "Test webhook delivery failed",
      statusCode: response.status,
      payload: testPayload,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await updateWebhookDelivery(db, delivery.id, {
      status: "failed",
      attemptCount: 1,
      completedAt: new Date(),
    });

    return c.json({
      message: "Test webhook delivery failed",
      error: errorMessage,
      payload: testPayload,
    }, 502);
  } finally {
    clearTimeout(timeoutId);
  }
});

// GET /webhooks/:webhookId/deliveries - Get webhook delivery history
app.get("/:webhookId/deliveries", requireAuth, async (c) => {
  const db = getDb();
  const webhookId = c.req.param("webhookId");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50"), 100);

  const webhook = await getWebhookById(db, webhookId);

  if (!webhook) {
    return c.json({ error: "Webhook not found", code: "NOT_FOUND" }, 404);
  }

  const deliveries = await getWebhookDeliveriesByWebhookId(db, webhookId, limit);

  return c.json({
    deliveries: deliveries.map((d: any) => ({
      id: d.id,
      event: d.event,
      status: d.status,
      responseCode: d.responseCode,
      attemptCount: d.attemptCount,
      createdAt: d.createdAt.toISOString(),
      completedAt: d.completedAt?.toISOString() ?? null,
    })),
  });
});

// GET /webhooks/:webhookId/dead-letters - Get failed deliveries
app.get("/:webhookId/dead-letters", requireAuth, async (c) => {
  const db = getDb();
  const webhookId = c.req.param("webhookId");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50"), 100);

  const webhook = await getWebhookById(db, webhookId);

  if (!webhook) {
    return c.json({ error: "Webhook not found", code: "NOT_FOUND" }, 404);
  }

  const deadLetters = await getWebhookDeadLettersByWebhookId(db, webhookId, limit);

  return c.json({
    deadLetters: deadLetters.map((d: any) => ({
      id: d.id,
      event: d.event,
      lastError: d.lastError,
      lastStatusCode: d.lastStatusCode,
      attemptCount: d.attemptCount,
      failedAt: d.failedAt.toISOString(),
      replayedAt: d.replayedAt?.toISOString() ?? null,
    })),
  });
});

// POST /webhooks/:webhookId/replay/:deadLetterId - Replay a dead letter
app.post("/:webhookId/replay/:deadLetterId", requireAuth, async (c) => {
  const db = getDb();
  const webhookId = c.req.param("webhookId");
  const deadLetterId = parseInt(c.req.param("deadLetterId"));

  const webhook = await getWebhookById(db, webhookId);

  if (!webhook) {
    return c.json({ error: "Webhook not found", code: "NOT_FOUND" }, 404);
  }

  // Get the dead letter
  const deadLetters = await getWebhookDeadLettersByWebhookId(db, webhookId, 100);
  const deadLetter = deadLetters.find((d: any) => d.id === deadLetterId);

  if (!deadLetter) {
    return c.json({ error: "Dead letter not found", code: "NOT_FOUND" }, 404);
  }

  if (deadLetter.replayedAt) {
    return c.json({ error: "Dead letter already replayed", code: "ALREADY_REPLAYED" }, 400);
  }

  // Mark as replayed
  const userId = c.get("user")?.sub;
  await markDeadLetterReplayed(db, deadLetterId, userId);

  // Actually send the webhook
  const signature = createHmac("sha256", webhook.secret).update(deadLetter.payload).digest("hex");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-DiscoLink-Signature": `sha256=${signature}`,
        "X-DiscoLink-Event": deadLetter.event,
        "X-DiscoLink-Delivery": `replay-${Date.now()}`,
      },
      body: deadLetter.payload,
      signal: controller.signal,
    });

    return c.json({
      message: response.ok ? "Dead letter replayed successfully" : "Replay delivery failed",
      statusCode: response.status,
    });
  } catch (error) {
    return c.json({
      message: "Replay delivery failed",
      error: error instanceof Error ? error.message : String(error),
    }, 502);
  } finally {
    clearTimeout(timeoutId);
  }
});

// POST /webhooks/:webhookId/rotate-secret - Rotate webhook secret
app.post("/:webhookId/rotate-secret", requireAuth, async (c) => {
  const db = getDb();
  const webhookId = c.req.param("webhookId");

  const webhook = await getWebhookById(db, webhookId);

  if (!webhook) {
    return c.json({ error: "Webhook not found", code: "NOT_FOUND" }, 404);
  }

  const newSecret = generateWebhookSecret();
  await updateWebhook(db, webhookId, { secret: newSecret });

  return c.json({
    message: "Webhook secret rotated",
    secret: newSecret,
  });
});

export default app;
