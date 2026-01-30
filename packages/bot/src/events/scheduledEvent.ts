import { type GuildScheduledEvent, type PartialGuildScheduledEvent } from "discord.js";
import { getDb, upsertScheduledEvent, deleteScheduledEvent, upsertUser } from "@discolink/db";
import { logger } from "../logger.js";
import { dispatchWebhookEvent } from "../lib/webhook-dispatcher.js";

export async function handleScheduledEventCreate(
  event: GuildScheduledEvent
): Promise<void> {
  const db = getDb();

  logger.debug(`Scheduled event created: ${event.name}`, {
    eventId: event.id,
    guildId: event.guildId,
  });

  try {
    // Ensure creator exists
    if (event.creatorId) {
      const creator = event.creator;
      if (creator) {
        await upsertUser(db, {
          id: creator.id,
          username: creator.username,
          globalName: creator.globalName,
          discriminator: creator.discriminator,
          avatar: creator.avatar,
          isBot: creator.bot,
        });
      }
    }

    await upsertScheduledEvent(db, {
      id: event.id,
      serverId: event.guildId,
      creatorId: event.creatorId ?? null,
      name: event.name,
      description: event.description ?? null,
      scheduledStartTime: event.scheduledStartAt!,
      scheduledEndTime: event.scheduledEndAt ?? null,
      entityType: event.entityType,
      status: event.status,
      channelId: event.channelId ?? null,
      location: event.entityMetadata?.location ?? null,
      userCount: event.userCount ?? 0,
      image: event.image ?? null,
    });

    logger.info(`Stored scheduled event: ${event.name}`, { eventId: event.id });

    await dispatchWebhookEvent(event.guildId, "sync.completed", {
      type: "scheduled_event.created",
      eventId: event.id,
      name: event.name,
    });
  } catch (error) {
    logger.error(`Failed to store scheduled event: ${event.name}`, {
      eventId: event.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleScheduledEventUpdate(
  _oldEvent: GuildScheduledEvent | PartialGuildScheduledEvent | null,
  newEvent: GuildScheduledEvent
): Promise<void> {
  const db = getDb();

  logger.debug(`Scheduled event updated: ${newEvent.name}`, {
    eventId: newEvent.id,
    status: newEvent.status,
  });

  try {
    await upsertScheduledEvent(db, {
      id: newEvent.id,
      serverId: newEvent.guildId,
      creatorId: newEvent.creatorId ?? null,
      name: newEvent.name,
      description: newEvent.description ?? null,
      scheduledStartTime: newEvent.scheduledStartAt!,
      scheduledEndTime: newEvent.scheduledEndAt ?? null,
      entityType: newEvent.entityType,
      status: newEvent.status,
      channelId: newEvent.channelId ?? null,
      location: newEvent.entityMetadata?.location ?? null,
      userCount: newEvent.userCount ?? 0,
      image: newEvent.image ?? null,
    });

    logger.debug(`Updated scheduled event: ${newEvent.name}`);

    await dispatchWebhookEvent(newEvent.guildId, "sync.completed", {
      type: "scheduled_event.updated",
      eventId: newEvent.id,
      name: newEvent.name,
      status: newEvent.status,
    });
  } catch (error) {
    logger.error(`Failed to update scheduled event: ${newEvent.name}`, {
      eventId: newEvent.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleScheduledEventDelete(
  event: GuildScheduledEvent | PartialGuildScheduledEvent
): Promise<void> {
  const db = getDb();

  logger.debug(`Scheduled event deleted`, { eventId: event.id });

  try {
    await deleteScheduledEvent(db, event.id);
    logger.info(`Deleted scheduled event: ${event.id}`);

    if (event.guildId) {
      await dispatchWebhookEvent(event.guildId, "sync.completed", {
        type: "scheduled_event.deleted",
        eventId: event.id,
      });
    }
  } catch (error) {
    logger.error(`Failed to delete scheduled event`, {
      eventId: event.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
