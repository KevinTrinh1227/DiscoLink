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

  // Sort by creation date, newest first
  return threads.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getThread(threadId: string): Promise<Thread> {
  const response = await fetch(`${API_URL}/threads/${threadId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch thread: ${response.status}`);
  }
  return response.json();
}

export function groupByMonth(threads: ThreadSummary[]): Map<string, ThreadSummary[]> {
  const grouped = new Map<string, ThreadSummary[]>();

  for (const thread of threads) {
    const date = new Date(thread.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(thread);
  }

  return grouped;
}

export function formatMonthYear(key: string): string {
  const [year, month] = key.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}
