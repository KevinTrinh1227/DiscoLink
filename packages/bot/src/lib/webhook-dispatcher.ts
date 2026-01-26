import { createHmac } from "crypto";
import { logger } from "../logger.js";
import { db } from "../client.js";
import {
  getActiveWebhooksByServerId,
  createWebhookDelivery,
  updateWebhookDelivery,
  incrementWebhookFailureCount,
  resetWebhookFailureCount,
  disableWebhook,
} from "@discordlink/db";

export type WebhookEvent =
  | "thread.created"
  | "thread.updated"
  | "thread.deleted"
  | "thread.resolved"
  | "message.created"
  | "message.updated"
  | "message.deleted"
  | "reaction.added"
  | "reaction.removed"
  | "sync.completed";

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  serverId: string;
  data: Record<string, unknown>;
}

const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff

function generateSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

async function sendWebhookRequest(
  url: string,
  payload: WebhookPayload,
  secret: string,
  attempt: number = 1
): Promise<{ success: boolean; statusCode?: number }> {
  const payloadStr = JSON.stringify(payload);
  const signature = generateSignature(payloadStr, secret);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-DiscordLink-Signature": `sha256=${signature}`,
        "X-DiscordLink-Event": payload.event,
        "X-DiscordLink-Delivery": `${Date.now()}-${attempt}`,
      },
      body: payloadStr,
    });

    return {
      success: response.ok,
      statusCode: response.status,
    };
  } catch (error) {
    logger.error(`Webhook request failed: ${error}`);
    return { success: false };
  }
}

async function dispatchToWebhook(
  webhookId: string,
  webhookUrl: string,
  webhookSecret: string,
  payload: WebhookPayload
): Promise<void> {
  // Create delivery record
  const delivery = await createWebhookDelivery(db, {
    webhookId,
    event: payload.event,
    payload: JSON.stringify(payload),
    status: "pending",
    attemptCount: 1,
  });

  let lastStatusCode: number | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const result = await sendWebhookRequest(
      webhookUrl,
      payload,
      webhookSecret,
      attempt
    );

    lastStatusCode = result.statusCode;

    if (result.success) {
      // Success - update delivery and reset failure count
      await updateWebhookDelivery(db, delivery.id, {
        status: "success",
        responseCode: result.statusCode,
        attemptCount: attempt,
      });
      await resetWebhookFailureCount(db, webhookId);

      logger.debug(
        `Webhook delivered successfully: ${webhookId} event=${payload.event}`
      );
      return;
    }

    // Failed - wait and retry
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAYS[attempt - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // Update attempt count
    await updateWebhookDelivery(db, delivery.id, {
      attemptCount: attempt,
    });
  }

  // All retries exhausted
  await updateWebhookDelivery(db, delivery.id, {
    status: "failed",
    responseCode: lastStatusCode,
    attemptCount: MAX_RETRIES,
  });

  // Increment failure count
  const webhook = await incrementWebhookFailureCount(db, webhookId);

  // Disable webhook after 10 consecutive failures
  if (webhook && webhook.failureCount >= 10) {
    await disableWebhook(db, webhookId);
    logger.warn(
      `Webhook disabled due to consecutive failures: ${webhookId}`
    );
  } else {
    logger.warn(
      `Webhook delivery failed after ${MAX_RETRIES} attempts: ${webhookId}`
    );
  }
}

export async function dispatchWebhookEvent(
  serverId: string,
  event: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  try {
    // Get all active webhooks for this server that are subscribed to this event
    const webhooks = await getActiveWebhooksByServerId(db, serverId);

    if (webhooks.length === 0) {
      return;
    }

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      serverId,
      data,
    };

    // Dispatch to each webhook in parallel
    const dispatchPromises = webhooks
      .filter((webhook) => {
        // Check if webhook is subscribed to this event
        const events = JSON.parse(webhook.events) as string[];
        return events.includes(event) || events.includes("*");
      })
      .map((webhook) =>
        dispatchToWebhook(webhook.id, webhook.url, webhook.secret, payload)
      );

    await Promise.allSettled(dispatchPromises);
  } catch (error) {
    logger.error(`Error dispatching webhook event: ${error}`);
  }
}
