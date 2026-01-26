// Default timeout for API requests (30 seconds)
const DEFAULT_TIMEOUT_MS = 30000;

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

// Read environment variables (validated lazily when API is called)
const API_URL = import.meta.env.DISCOLINK_API_URL || 'http://localhost:3000';
const SERVER_ID = import.meta.env.DISCOLINK_SERVER_ID;

/**
 * Validate that required environment variables are set.
 * Called lazily when API functions are invoked, not at module load.
 * This allows templates to build even without env vars configured.
 */
function validateConfig(): string {
  if (!SERVER_ID) {
    throw new Error(
      `DISCOLINK_SERVER_ID environment variable is required.\n\n` +
      `Add it to your .env file:\n` +
      `  DISCOLINK_SERVER_ID=your_discord_server_id\n\n` +
      `Or set it in your deployment config (Vercel, Netlify, etc.)`
    );
  }
  return SERVER_ID;
}

// ============================================================================
// FETCH WITH TIMEOUT
// ============================================================================

/**
 * Fetch with timeout using AbortController.
 * Prevents infinite hangs on network issues during static site generation.
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

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

// ============================================================================
// API FUNCTIONS
// ============================================================================

export async function getServer(): Promise<Server> {
  const serverId = validateConfig();
  const response = await fetchWithTimeout(`${API_URL}/servers/${serverId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch server: ${response.status}`);
  }
  return response.json();
}

export async function getThreads(): Promise<ThreadSummary[]> {
  const serverId = validateConfig();
  const threads: ThreadSummary[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({ serverId, limit: '100' });
    if (cursor) params.set('cursor', cursor);

    const response = await fetchWithTimeout(`${API_URL}/threads?${params}`);
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
  validateConfig(); // Ensure config is valid
  const response = await fetchWithTimeout(`${API_URL}/threads/${threadId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch thread: ${response.status}`);
  }
  return response.json();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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
