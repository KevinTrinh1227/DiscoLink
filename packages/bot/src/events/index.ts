import { type Client, Events } from "discord.js";
import { handleReady } from "./ready.js";
import { handleGuildCreate, handleGuildDelete, handleGuildMemberUpdate } from "./guild.js";
import { handleInteractionCreate } from "./interaction.js";
import {
  handleMessageCreate,
  handleMessageUpdate,
  handleMessageDelete,
  handleMessageDeleteBulk,
} from "./message.js";
import {
  handleReactionAdd,
  handleReactionRemove,
  handleReactionRemoveAll,
} from "./reaction.js";
import {
  handleThreadCreate,
  handleThreadUpdate,
  handleThreadDelete,
} from "./thread.js";
import {
  handleScheduledEventCreate,
  handleScheduledEventUpdate,
  handleScheduledEventDelete,
} from "./scheduledEvent.js";

export function registerEvents(client: Client): void {
  // Ready event
  client.once(Events.ClientReady, handleReady);

  // Guild events
  client.on(Events.GuildCreate, handleGuildCreate);
  client.on(Events.GuildDelete, handleGuildDelete);
  client.on(Events.GuildMemberUpdate, handleGuildMemberUpdate);

  // Interaction events (slash commands)
  client.on(Events.InteractionCreate, handleInteractionCreate);

  // Message events
  client.on(Events.MessageCreate, handleMessageCreate);
  client.on(Events.MessageUpdate, handleMessageUpdate);
  client.on(Events.MessageDelete, handleMessageDelete);
  client.on(Events.MessageBulkDelete, handleMessageDeleteBulk);

  // Reaction events
  client.on(Events.MessageReactionAdd, handleReactionAdd);
  client.on(Events.MessageReactionRemove, handleReactionRemove);
  client.on(Events.MessageReactionRemoveAll, handleReactionRemoveAll);

  // Thread events
  client.on(Events.ThreadCreate, handleThreadCreate);
  client.on(Events.ThreadUpdate, handleThreadUpdate);
  client.on(Events.ThreadDelete, handleThreadDelete);

  // Scheduled event events
  client.on(Events.GuildScheduledEventCreate, handleScheduledEventCreate);
  client.on(Events.GuildScheduledEventUpdate, handleScheduledEventUpdate);
  client.on(Events.GuildScheduledEventDelete, handleScheduledEventDelete);
}
