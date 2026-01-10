# Multi-Platform Notifications Guide

This guide explains how to configure and use multiple notification platforms with Workers Builds Notifications.

## Supported Platforms

- **Slack** - Team collaboration platform
- **Lark/Feishu** - ByteDance's collaboration platform (飞书)
- **Discord** - Community and team chat platform

## Quick Start

### 1. Configure Webhooks

You can enable one, two, or all three platforms simultaneously. Simply set the corresponding environment variables:

```bash
# Slack (optional)
wrangler secret put SLACK_WEBHOOK_URL
# Enter: https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Lark/Feishu (optional)
wrangler secret put LARK_WEBHOOK_URL
# Enter: https://open.feishu.cn/open-apis/bot/v2/hook/YOUR-WEBHOOK-ID

# Discord (optional)
wrangler secret put DISCORD_WEBHOOK_URL
# Enter: https://discord.com/api/webhooks/YOUR/WEBHOOK/URL

# Cloudflare API Token (required)
wrangler secret put CLOUDFLARE_API_TOKEN
# Enter: your_cloudflare_api_token
```

### 2. Deploy

```bash
wrangler deploy
```

That's it! The worker will automatically send notifications to all configured platforms.

## Platform-Specific Setup

### Slack

1. Go to [Slack Apps](https://api.slack.com/apps)
2. Create a new app → **From scratch**
3. Enable **Incoming Webhooks**
4. Add webhook to your workspace
5. Copy the webhook URL

**Message Format:** Uses Slack Block Kit with interactive buttons

### Lark/Feishu (飞书)

1. Open your Lark/Feishu group chat
2. Click **Group Settings** → **Bots** → **Add Bot**
3. Select **Custom Bot** (自定义机器人)
4. Enter name and description
5. Copy the webhook URL
6. Click **Finish** (完成)

**Message Format:** Uses interactive card messages with colored headers

### Discord

1. Go to your Discord server
2. **Server Settings** → **Integrations** → **Webhooks**
3. Click **New Webhook**
4. Name it and select a channel
5. Copy the webhook URL
6. Click **Save**

**Message Format:** Uses embed messages with colored sidebars

## Message Examples

### Success Notification

All platforms will show:
- ✅ Status indicator (Production/Preview Deploy)
- Worker name
- Branch name
- Commit hash (with link to GitHub/GitLab if available)
- Author name
- Action button (View Worker/View Preview/View Build)

### Failure Notification

All platforms will show:
- ❌ Status indicator
- Worker name
- Build metadata (branch, commit, author)
- Error message in code block
- Action button (View Logs)

### Cancelled Notification

All platforms will show:
- ⚠️ Status indicator
- Worker name
- Build metadata
- Action button (View Build)

## Configuration Examples

### Single Platform (Slack only)

```bash
# .dev.vars or wrangler secrets
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
CLOUDFLARE_API_TOKEN=your_token
```

### Dual Platform (Slack + Lark)

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
LARK_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/...
CLOUDFLARE_API_TOKEN=your_token
```

### All Platforms

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
LARK_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/...
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
CLOUDFLARE_API_TOKEN=your_token
```

## Error Handling

The worker is designed to be resilient:

- If one platform fails, notifications continue to other platforms
- Each platform's notification is sent in parallel for speed
- Errors are logged but don't stop the queue processing
- If no webhooks are configured, a warning is logged

## Testing

Run the test suite to verify all platforms work correctly:

```bash
npm test
```

The test suite includes:
- Single platform tests
- Multi-platform simultaneous sending
- Error recovery (one platform fails, others succeed)
- Payload format validation for each platform

## Troubleshooting

### No notifications appearing

1. Check worker logs: `wrangler tail`
2. Verify webhook URLs are correct
3. Ensure at least one webhook is configured

### Notifications only appear in some platforms

- Check logs for platform-specific errors
- Verify each webhook URL is valid
- Test webhooks manually with curl

### Lark notifications not appearing

- Ensure webhook URL starts with `https://open.feishu.cn/`
- Check if webhook is rate-limited
- Verify bot is not disabled in group settings

### Discord notifications not appearing

- Ensure webhook URL is complete (includes token)
- Check if webhook was deleted in Discord settings
- Verify channel permissions

## Advanced Usage

### Adding a New Platform

To add support for another platform:

1. Create a new notifier in `src/notifiers/your-platform.ts`
2. Implement the `Notifier` interface
3. Add webhook URL to `src/types.ts` Env interface
4. Register in `src/notificationManager.ts` NOTIFIERS array
5. Update `.dev.vars.example` and README

See existing notifiers (Slack, Lark, Discord) as examples.

## API Reference

### Notifier Interface

```typescript
interface Notifier {
  readonly name: string;
  buildPayload(data: NotificationData): unknown;
  send(webhookUrl: string, payload: unknown): Promise<void>;
}
```

### NotificationData

```typescript
interface NotificationData {
  event: CloudflareEvent;
  previewUrl: string | null;
  liveUrl: string | null;
  logs: string[];
}
```

## License

Same as the main project (see LICENSE file).
