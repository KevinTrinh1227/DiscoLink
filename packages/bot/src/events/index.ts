import { type Client, Events } from "discord.js";
import { handleReady } from "./ready.js";
import { handleGuildCreate, handleGuildDelete } from "./guild.js";
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

export function registerEvents(client: Client): void {
  // Ready event
  client.once(Events.ClientReady, handleReady);

  // Guild events
  client.on(Events.GuildCreate, handleGuildCreate);
  client.on(Events.GuildDelete, handleGuildDelete);

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
}
