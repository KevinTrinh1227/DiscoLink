import type { User, Message, Thread } from "@discordlink/db";

export interface AnonymousUser {
  id: "anonymous";
  username: "Anonymous";
  avatar: null;
  isAnonymous: true;
  isBot: false;
}

export const anonymousUser: AnonymousUser = {
  id: "anonymous",
  username: "Anonymous",
  avatar: null,
  isAnonymous: true,
  isBot: false,
};

export interface ConsentCheckContext {
  requesterId?: string | undefined;
  requesterGuildIds?: string[] | undefined;
  isAuthenticated: boolean;
}

export function canViewUser(
  user: User,
  targetServerId: string,
  context: ConsentCheckContext
): boolean {
  const consent = user.consentStatus ?? "public";

  switch (consent) {
    case "public":
      return true;

    case "anonymous":
      return true; // Can view, but will be anonymized

    case "private":
      if (!context.isAuthenticated) return false;
      // User can view their own data
      if (context.requesterId === user.id) return true;
      // User can view if they share a server
      return context.requesterGuildIds?.includes(targetServerId) ?? false;
  }
}

export function shouldAnonymize(user: User): boolean {
  return user.consentStatus === "anonymous";
}

export function filterUserData<T extends { author?: User | null }>(
  item: T,
  targetServerId: string,
  context: ConsentCheckContext
): T & { author?: User | AnonymousUser | null } {
  if (!item.author) return item;

  if (!canViewUser(item.author, targetServerId, context)) {
    return { ...item, author: null };
  }

  if (shouldAnonymize(item.author)) {
    return { ...item, author: anonymousUser };
  }

  return item;
}

export function filterMessagesByConsent(
  messages: (Message & { author?: User | null })[],
  serverId: string,
  context: ConsentCheckContext
): (Message & { author?: User | AnonymousUser | null })[] {
  return messages
    .filter((msg) => {
      if (!msg.author) return true;
      const consent = msg.author.consentStatus ?? "public";
      if (consent === "private" && !context.isAuthenticated) return false;
      if (consent === "private" && context.requesterId !== msg.author.id) {
        return context.requesterGuildIds?.includes(serverId) ?? false;
      }
      return true;
    })
    .map((msg) => filterUserData(msg, serverId, context));
}

export function filterThreadsByConsent(
  threads: (Thread & { author?: User | null })[],
  serverId: string,
  context: ConsentCheckContext
): (Thread & { author?: User | AnonymousUser | null })[] {
  return threads
    .filter((thread) => {
      if (!thread.author) return true;
      const consent = thread.author.consentStatus ?? "public";
      if (consent === "private" && !context.isAuthenticated) return false;
      if (consent === "private" && context.requesterId !== thread.author.id) {
        return context.requesterGuildIds?.includes(serverId) ?? false;
      }
      return true;
    })
    .map((thread) => filterUserData(thread, serverId, context));
}
