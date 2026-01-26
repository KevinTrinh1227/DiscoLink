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
    const response = await fetch(`${this.baseUrl}/servers/${serverId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch server: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getThread(threadId: string): Promise<Thread> {
    const response = await fetch(`${this.baseUrl}/threads/${threadId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch thread: ${response.status} ${response.statusText}`);
    }

    return response.json();
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

    const response = await fetch(`${this.baseUrl}/threads?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch threads: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getAllThreads(serverId: string, channelId?: string): Promise<ThreadSummary[]> {
    const threads: ThreadSummary[] = [];
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getThreads(serverId, {
        channelId,
        limit: 100,
        cursor,
      });

      threads.push(...response.threads);
      hasMore = response.pagination.hasMore;
      cursor = response.pagination.nextCursor;
    }

    return threads;
  }

  async getChannels(serverId: string): Promise<Array<{ id: string; name: string; type: number }>> {
    const response = await fetch(`${this.baseUrl}/servers/${serverId}/channels`);

    if (!response.ok) {
      throw new Error(`Failed to fetch channels: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.channels;
  }

  async getRssFeed(serverId: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/feeds/${serverId}/rss`);

    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
    }

    return response.text();
  }
}
