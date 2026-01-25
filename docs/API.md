# API Reference

The Discord Forum API exposes RESTful endpoints for accessing synced Discord forum content.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Most endpoints are public. Protected endpoints require Discord OAuth authentication via the `Authorization` header.

---

## Servers

### GET /servers/:serverId

Get server information.

**Response:**
```json
{
  "id": "123456789",
  "name": "My Server",
  "icon": "abc123",
  "description": "Server description",
  "memberCount": 1000
}
```

### GET /servers/:serverId/channels

List all synced forum channels in a server.

**Response:**
```json
{
  "channels": [
    {
      "id": "123456789",
      "name": "help-forum",
      "type": 15,
      "topic": "Ask for help here",
      "position": 0,
      "parentId": "987654321"
    }
  ]
}
```

### GET /servers/:serverId/tags

List all tags across forum channels.

**Response:**
```json
{
  "tags": [
    {
      "id": "123",
      "name": "Solved",
      "emoji": "checkmark",
      "channelId": "456",
      "channelName": "help-forum"
    }
  ]
}
```

### GET /servers/:serverId/stats

Get comprehensive server statistics (cached for 60 seconds).

**Response:**
```json
{
  "serverId": "123456789",
  "serverName": "My Server",
  "stats": {
    "threads": {
      "total": 150,
      "open": 45,
      "resolved": 100,
      "archived": 5
    },
    "messages": {
      "total": 5000,
      "byHumans": 4500,
      "byBots": 500,
      "avgPerThread": 33
    },
    "participants": {
      "unique": 200,
      "humans": 180,
      "bots": 20
    },
    "channels": 5,
    "reactions": {
      "total": 1500,
      "uniqueEmojis": 50
    }
  },
  "topContributors": [...],
  "mostActiveChannels": [...],
  "lastSyncAt": "2024-01-15T12:00:00.000Z"
}
```

---

## Threads

### GET /threads

List threads with filtering and pagination.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `serverId` | string | - | Filter by server |
| `channelId` | string | - | Filter by channel |
| `tag` | string | - | Filter by tag |
| `status` | enum | `all` | `open`, `resolved`, `locked`, `all` |
| `sort` | enum | `latest` | `latest`, `oldest`, `popular`, `recently_active`, `unanswered` |
| `limit` | number | 20 | Results per page (1-100) |
| `cursor` | string | - | Pagination cursor |

**Response:**
```json
{
  "threads": [
    {
      "id": "123456789",
      "title": "How do I...",
      "slug": "how-do-i",
      "preview": "First 200 characters...",
      "status": "open",
      "messageCount": 5,
      "author": {
        "id": "user123",
        "username": "User",
        "avatar": "abc123"
      },
      "tags": ["question"],
      "createdAt": "2024-01-15T12:00:00.000Z",
      "lastActivityAt": "2024-01-15T14:00:00.000Z"
    }
  ],
  "nextCursor": "abc123",
  "hasMore": true
}
```

### GET /threads/:threadId

Get full thread details including all messages.

**Response:**
```json
{
  "id": "123456789",
  "title": "Thread Title",
  "slug": "thread-title",
  "status": "open",
  "author": {...},
  "tags": [...],
  "messages": [
    {
      "id": "msg123",
      "content": "Message content",
      "contentHtml": "<p>Message content</p>",
      "author": {...},
      "attachments": [...],
      "reactions": [...],
      "embeds": [...],
      "createdAt": "2024-01-15T12:00:00.000Z"
    }
  ],
  "messageCount": 5,
  "createdAt": "2024-01-15T12:00:00.000Z"
}
```

### GET /threads/:threadId/participants

Get thread participants.

**Response:**
```json
{
  "total": 10,
  "humans": 8,
  "bots": 2,
  "participants": [
    {
      "userId": "user123",
      "username": "User",
      "avatar": "abc123",
      "isBot": false,
      "messageCount": 5,
      "joinedAt": "2024-01-15T12:00:00.000Z"
    }
  ]
}
```

---

## Search

### GET /search

Search threads and messages.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | required | Search query |
| `serverId` | string | - | Filter by server |
| `channelId` | string | - | Filter by channel |
| `type` | enum | `all` | `threads`, `messages`, `all` |
| `limit` | number | 20 | Results per page |

**Response:**
```json
{
  "query": "search term",
  "results": {
    "threads": [...],
    "messages": [...]
  },
  "total": 25
}
```

---

## Leaderboard

### GET /leaderboard/:serverId

Get user leaderboard (cached for 120 seconds).

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | enum | `messages` | `messages`, `threads`, `reactions` |
| `limit` | number | 10 | Results (1-50) |
| `excludeBots` | boolean | false | Exclude bot users |
| `botsOnly` | boolean | false | Only bot users |

**Response:**
```json
{
  "serverId": "123456789",
  "type": "messages",
  "filters": {
    "excludeBots": false,
    "botsOnly": false
  },
  "leaderboard": [
    {
      "rank": 1,
      "userId": "user123",
      "username": "TopUser",
      "avatar": "abc123",
      "isBot": false,
      "count": 500
    }
  ]
}
```

---

## Users

### GET /users/:userId

Get user profile.

**Response:**
```json
{
  "id": "user123",
  "username": "User",
  "globalName": "Display Name",
  "avatar": "abc123",
  "banner": "def456",
  "isBot": false,
  "badges": ["verified_developer", "early_supporter"],
  "premiumType": "Nitro"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Human-readable message",
  "code": "ERROR_CODE"
}
```

**Common Error Codes:**
| Code | Status | Description |
|------|--------|-------------|
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid parameters |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Access denied |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limiting

The API implements caching on frequently accessed endpoints:
- `/servers/:serverId/stats` - 60 second cache
- `/leaderboard/:serverId` - 120 second cache

Cache status is returned in headers:
- `X-Cache: HIT` or `X-Cache: MISS`
- `X-Cache-TTL: <seconds remaining>`
