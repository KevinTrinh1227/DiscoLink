// Default timeout for API requests (30 seconds)
const DEFAULT_TIMEOUT_MS = 30000;

// Retry configuration
const DEFAULT_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

/**
 * Sleep for a specified duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout using AbortController.
 * Prevents infinite hangs on network issues.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch with automatic retry and exponential backoff.
 *
 * Retry logic:
 * - Retries on network errors and 5xx server errors
 * - Respects Retry-After header for 429 (rate limit) responses
 * - Uses exponential backoff with jitter
 * - Does NOT retry 4xx client errors (except 429)
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = DEFAULT_RETRIES,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);

      // Handle rate limiting with Retry-After header
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : RETRY_BASE_DELAY_MS * Math.pow(2, attempt);

        if (attempt < maxRetries) {
          await sleep(waitMs);
          continue;
        }
      }

      // Success or non-retryable error (4xx except 429)
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      // Server error (5xx) - retry
      if (response.status >= 500 && attempt < maxRetries) {
        const backoffMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        // Add jitter (0-25% of backoff)
        const jitter = backoffMs * Math.random() * 0.25;
        await sleep(backoffMs + jitter);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Network error or timeout - retry if we have attempts left
      if (attempt < maxRetries) {
        const backoffMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        const jitter = backoffMs * Math.random() * 0.25;
        await sleep(backoffMs + jitter);
        continue;
      }
    }
  }

  throw lastError || new Error(`Failed after ${maxRetries + 1} attempts: ${url}`);
}

interface ThreadSummary {
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

interface Thread extends ThreadSummary {
  serverId: string;
  channelId: string;
  isArchived: boolean;
  isLocked: boolean;
  isPinned: boolean;
  tags: Array<{ id: string; name: string; emoji: string | null }>;
  messages: Array<{
    id: string;
    content: string;
    contentHtml: string | null;
    createdAt: string;
    editedAt: string | null;
    isEdited: boolean;
    isAnswer: boolean;
    isPinned: boolean;
    author: {
      id: string;
      username: string;
      avatar: string | null;
      isBot: boolean;
    } | null;
    attachments: Array<{
      id: string;
      filename: string;
      url: string;
      contentType: string | null;
      size: number;
      width: number | null;
      height: number | null;
      isImage: boolean;
      isVideo: boolean;
    }>;
    reactions: Array<{
      emoji: string;
      emojiName: string | null;
      count: number;
      isCustom: boolean;
    }>;
  }>;
}

interface Server {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  memberCount: number | null;
}

interface PaginatedResponse<T> {
  threads: T[];
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
  };
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
  }

  async getServer(serverId: string): Promise<Server> {
    const response = await fetchWithRetry(`${this.baseUrl}/servers/${serverId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch server: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<Server>;
  }

  async getThread(threadId: string): Promise<Thread> {
    const response = await fetchWithRetry(`${this.baseUrl}/threads/${threadId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch thread: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<Thread>;
  }

  async getThreads(
    serverId: string,
    options?: {
      channelId?: string;
      status?: string;
      limit?: number;
      cursor?: string;
    }
  ): Promise<PaginatedResponse<ThreadSummary>> {
    const params = new URLSearchParams();
    params.set("serverId", serverId);

    if (options?.channelId) params.set("channelId", options.channelId);
    if (options?.status) params.set("status", options.status);
    if (options?.limit) params.set("limit", options.limit.toString());
    if (options?.cursor) params.set("cursor", options.cursor);

    const response = await fetchWithRetry(`${this.baseUrl}/threads?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch threads: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<PaginatedResponse<ThreadSummary>>;
  }

  async getAllThreads(serverId: string, channelId?: string): Promise<ThreadSummary[]> {
    const threads: ThreadSummary[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const opts: { channelId?: string; limit: number; cursor?: string } = { limit: 100 };
      if (channelId) opts.channelId = channelId;
      if (cursor) opts.cursor = cursor;

      const response = await this.getThreads(serverId, opts);

      threads.push(...response.threads);
      hasMore = response.pagination.hasMore;
      cursor = response.pagination.nextCursor;
    }

    return threads;
  }

  async getChannels(serverId: string): Promise<Array<{ id: string; name: string; type: number }>> {
    const response = await fetchWithRetry(`${this.baseUrl}/servers/${serverId}/channels`);

    if (!response.ok) {
      throw new Error(`Failed to fetch channels: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { channels: Array<{ id: string; name: string; type: number }> };
    return data.channels;
  }

  async getRssFeed(serverId: string): Promise<string> {
    const response = await fetchWithRetry(`${this.baseUrl}/feeds/${serverId}/rss`);

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
    }

    return response.text();
  }

  /**
   * Check API health/connectivity.
   * Uses a short timeout for quick failure detection.
   */
  async checkHealth(timeoutMs: number = 5000): Promise<boolean> {
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/health`, {}, timeoutMs);
      return response.ok;
    } catch {
      return false;
    }
  }
}
