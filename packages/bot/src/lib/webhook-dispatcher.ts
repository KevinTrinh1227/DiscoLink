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
  createWebhookDeadLetter,
} from "@discolink/db";

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
const WEBHOOK_TIMEOUT_MS = 30000; // 30 second timeout for webhook requests

function generateSignature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

async function sendWebhookRequest(
  url: string,
  payload: WebhookPayload,
  secret: string,
  attempt: number = 1
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const payloadStr = JSON.stringify(payload);
  const signature = generateSignature(payloadStr, secret);

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-DiscoLink-Signature": `sha256=${signature}`,
        "X-DiscoLink-Event": payload.event,
        "X-DiscoLink-Delivery": `${Date.now()}-${attempt}`,
      },
      body: payloadStr,
      signal: controller.signal,
    });

    return {
      success: response.ok,
      statusCode: response.status,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if it was a timeout
    if (error instanceof Error && error.name === "AbortError") {
      logger.warn(`Webhook request timed out after ${WEBHOOK_TIMEOUT_MS}ms: ${url}`);
      return { success: false, error: `Timeout after ${WEBHOOK_TIMEOUT_MS}ms` };
    }

    logger.error(`Webhook request failed: ${errorMessage}`);
    return { success: false, error: errorMessage };
  } finally {
    clearTimeout(timeoutId);
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

  // Add to dead letter queue for later manual replay
  try {
    await createWebhookDeadLetter(db, {
      webhookId,
      event: payload.event,
      payload: JSON.stringify(payload),
      lastError: `Failed after ${MAX_RETRIES} attempts`,
      lastStatusCode,
      attemptCount: MAX_RETRIES,
    });
    logger.info(
      `Webhook delivery added to dead letter queue: ${webhookId} event=${payload.event}`
    );
  } catch (deadLetterError) {
    logger.error(`Failed to create dead letter entry: ${deadLetterError}`);
  }

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
