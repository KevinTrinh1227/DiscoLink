# Discord Setup Guide

This guide walks through creating and configuring a Discord application for the Forum API.

## Create Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)

2. Click **"New Application"**

3. Enter a name (e.g., "Forum Sync Bot") and create

4. Note your **Application ID** (also called Client ID)

## Configure Bot

1. Navigate to **Bot** in the sidebar

2. Click **"Add Bot"** if not already created

3. **Copy the Bot Token** - you'll need this for `DISCORD_TOKEN`

4. Configure bot settings:
   - **Public Bot**: Disable if you want to control which servers can add it
   - **Requires OAuth2 Code Grant**: Leave disabled

### Enable Privileged Intents

The bot needs these intents to function properly:

1. Scroll to **Privileged Gateway Intents**

2. Enable:
   - **Message Content Intent** - Required to read message content
   - **Server Members Intent** - Optional, for member data

3. Save changes

## Configure OAuth2

If you want users to authenticate via Discord:

1. Navigate to **OAuth2** > **General**

2. Add redirect URLs:
   ```
   http://localhost:3000/auth/callback
   https://yourdomain.com/auth/callback
   ```

3. Note your **Client Secret** for `DISCORD_CLIENT_SECRET`

## Generate Bot Invite Link

1. Navigate to **OAuth2** > **URL Generator**

2. Select scopes:
   - `bot`
   - `applications.commands`

3. Select bot permissions:
   - **Read Messages/View Channels**
   - **Read Message History**
   - **Add Reactions** (optional)

4. Copy the generated URL

5. Open the URL in browser to add bot to your server

## Required Permissions

Minimum permissions the bot needs:

| Permission | Required | Purpose |
|------------|----------|---------|
| View Channels | Yes | See forum channels |
| Read Message History | Yes | Sync existing messages |
| Read Messages | Yes | Receive new messages |
| Add Reactions | Optional | Track reactions |

**Permission Integer:** `68608`

## Environment Variables

Add these to your `.env` file:

```env
# Required
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_id_here

# For OAuth (optional)
DISCORD_CLIENT_SECRET=your_client_secret_here
```

## Server Configuration

### Enable Forum Channels

1. In your Discord server, go to **Server Settings** > **Community**

2. Enable **Community Features** if not already enabled

3. Create a forum channel:
   - Right-click category > **Create Channel**
   - Select **Forum** as channel type
   - Configure tags, guidelines, etc.

### Bot Permissions in Server

Ensure the bot role has access to:

1. The forum channels you want to sync
2. Any parent categories containing those channels

To check:
1. Right-click the forum channel > **Edit Channel**
2. Go to **Permissions**
3. Verify bot role can view and read

## Initial Sync

Once the bot joins a server, it automatically:

1. Syncs server metadata
2. Discovers forum channels
3. Syncs existing threads and messages

You can trigger a manual resync with the `/sync` command if you have admin permissions.

## Troubleshooting

### Bot is online but not syncing

- Check bot has `View Channels` permission
- Verify `MESSAGE_CONTENT` intent is enabled
- Check logs for error messages

### Missing message content

Message content requires the **Message Content Intent**:
1. Enable in Developer Portal > Bot > Privileged Intents
2. Restart the bot

### Reactions not tracking

- Ensure `Add Reactions` permission is granted
- The bot tracks reactions on synced messages only

### OAuth not working

- Verify redirect URL matches exactly (including trailing slash)
- Check `DISCORD_CLIENT_SECRET` is set correctly

## Rate Limits

Discord has rate limits. The bot handles these automatically, but for large servers:

- Initial sync may take several minutes
- Avoid triggering multiple resyncs simultaneously

## Security Notes

- Never commit your bot token to version control
- Regenerate token immediately if exposed
- Use environment variables for all secrets
- Consider using a secrets manager in production
