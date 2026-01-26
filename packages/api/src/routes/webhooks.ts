import { Hono } from "hono";
import { z } from "zod";
import { randomBytes } from "crypto";
import {
  getDb,
  webhooks,
  webhookDeliveries,
  servers,
  createWebhook,
  getWebhookById,
  getWebhooksByServerId,
  updateWebhook,
  deleteWebhook,
  getWebhookDeliveriesByWebhookId,
  eq,
  and,
} from "@discolink/db";
import { requireAuth } from "../middleware/auth.js";

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
    webhooks: webhookList.map((wh) => ({
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
    event: "test",
    timestamp: new Date().toISOString(),
    serverId: webhook.serverId,
    data: {
      message: "This is a test webhook delivery from DiscoLink",
    },
  };

  // TODO: Actually send the webhook (will be implemented in Phase 5)
  // For now, just return what would be sent
  return c.json({
    message: "Test webhook queued",
    payload: testPayload,
  });
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
    deliveries: deliveries.map((d) => ({
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
