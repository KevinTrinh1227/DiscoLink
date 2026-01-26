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

const API_URL = import.meta.env.DISCOLINK_API_URL || 'http://localhost:3000';
const SERVER_ID = import.meta.env.DISCOLINK_SERVER_ID;

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

export async function getResolvedThreads(): Promise<ThreadSummary[]> {
  const threads = await getThreads();
  return threads.filter((t) => t.status === 'resolved');
}

export function getTagsFromThreads(threads: ThreadSummary[]): string[] {
  const tagSet = new Set<string>();
  // Note: ThreadSummary doesn't include tags, so this would need full thread data
  return Array.from(tagSet);
}
