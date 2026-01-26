export interface Thread {
  id: string;
  title: string;
  slug: string;
  status: string;
  messageCount: number;
  createdAt: string;
  lastActivityAt: string;
  isArchived: boolean;
  isLocked: boolean;
  isPinned: boolean;
  tags: Array<{ id: string; name: string; emoji: string | null }>;
  author: {
    id: string;
    username: string;
    avatar: string | null;
  } | null;
  messages: Array<{
    id: string;
    content: string;
    contentHtml: string | null;
    createdAt: string;
    isAnswer: boolean;
    author: {
      id: string;
      username: string;
      avatar: string | null;
      isBot: boolean;
    } | null;
  }>;
}

export interface ThreadSummary {
  id: string;
  title: string;
  slug: string;
  status: string;
  messageCount: number;
  createdAt: string;
  lastActivityAt: string;
  author: {
    id: string;
    username: string;
    avatar: string | null;
  } | null;
}

export interface Server {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
}

const API_URL = import.meta.env.DISCORDLINK_API_URL || 'http://localhost:3000';
const SERVER_ID = import.meta.env.DISCORDLINK_SERVER_ID;

export async function getServer(): Promise<Server> {
  const response = await fetch(`${API_URL}/servers/${SERVER_ID}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch server: ${response.status}`);
  }
  return response.json();
}

export async function getThreads(): Promise<ThreadSummary[]> {
  const threads: ThreadSummary[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({ serverId: SERVER_ID, limit: '100' });
    if (cursor) params.set('cursor', cursor);

    const response = await fetch(`${API_URL}/threads?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch threads: ${response.status}`);
    }

    const data = await response.json();
    threads.push(...data.threads);
    hasMore = data.pagination.hasMore;
    cursor = data.pagination.nextCursor;
  }

  return threads;
}

export async function getThread(threadId: string): Promise<Thread> {
  const response = await fetch(`${API_URL}/threads/${threadId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch thread: ${response.status}`);
  }
  return response.json();
}

export interface Category {
  name: string;
  emoji: string | null;
  threads: ThreadSummary[];
}

export function groupByCategory(threads: ThreadSummary[]): Category[] {
  // Since ThreadSummary doesn't have tags, we'll return a single "All Articles" category
  // In a real implementation, you'd need to fetch full thread data for tags
  return [{
    name: 'All Articles',
    emoji: null,
    threads: threads.sort((a, b) =>
      new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
    ),
  }];
}
