# Scheduled Messages Module

A comprehensive staff-only module for scheduling messages to be sent at specific times or on recurring schedules.

## Features

- **One-time Messages**: Schedule messages for a specific date and time
- **Recurring Messages**: Use cron expressions or simple intervals (every X hours/days/weeks)
- **Multiple Content Types**: Support both plain text and Discord embeds
- **Rich Embed Builder**: Title, description, color, footer, image, thumbnail, and custom fields
- **Message Management**: List, edit, and delete scheduled messages
- **Configuration**: Guild-specific settings including max messages per guild
- **Error Handling**: Gracefully handles deleted channels, missing permissions, and invalid crons
- **Audit Logging**: Emit events when messages are sent
- **Smart Scheduler**: Checks every 30 seconds for messages that need to be sent

## Commands

### /schedule
Create a new scheduled message.

**Parameters:**
- `channel` (required): Channel to send the message to
- `type` (required): `once` for one-time or `recurring` for recurring
- `datetime` (required for one-time): ISO format (2025-12-31T15:30) or relative (1h, 30m, 2d)
- `cron` (for recurring): Cron expression (minute hour day month dayOfWeek)
- `interval` (for recurring): Simple interval like "2h", "30m", "1d"
- `message` (optional): Plain text message content
- `embed` (optional): JSON embed data

**Examples:**
```
/schedule channel:#announcements type:once datetime:2h message:Server maintenance in 2 hours!
/schedule channel:#daily type:recurring cron:"0 9 * * 1" message:Good morning! (9am every Monday)
/schedule channel:#updates type:recurring interval:1d embed:{...json...}
```

### /schedulelist
List all scheduled messages in the guild with optional filtering.

**Parameters:**
- `filter` (optional): `all` (default), `active`, or `inactive`

### /scheduleedit
Edit any aspect of a scheduled message.

**Parameters:**
- `id` (required): Message ID (autocomplete available)
- `channel` (optional): New channel
- `message` (optional): New plain text content
- `embed` (optional): New embed data
- `datetime` (optional): New datetime for one-time messages
- `cron` (optional): New cron expression for recurring messages
- `interval` (optional): New simple interval for recurring messages
- `active` (optional): Enable/disable the message

### /scheduledelete
Delete a scheduled message with confirmation prompt.

**Parameters:**
- `id` (required): Message ID (autocomplete available)

### /scheduleconfig
Configure module settings per guild.

**Subcommands:**

#### view
View current configuration

#### set
Update a configuration setting
- `setting`: `enabled`, `maxScheduledPerGuild`, `timezone`
- `value`: New value for the setting

## Cron Expression Format

Standard cron format: `minute hour day month dayOfWeek`

Examples:
- `0 9 * * 1` - 9:00 AM every Monday
- `30 14 * * *` - 2:30 PM every day
- `0 0 1 * *` - Midnight on the 1st of every month
- `*/15 * * * *` - Every 15 minutes
- `0 */6 * * *` - Every 6 hours

## Simple Interval Format

- `s` - Seconds (e.g., "30s")
- `m` - Minutes (e.g., "15m")
- `h` - Hours (e.g., "2h")
- `d` - Days (e.g., "1d")

## Embed JSON Format

```json
{
  "title": "Message Title",
  "description": "Message description",
  "color": "#0099ff",
  "footer": "Footer text",
  "image": "https://example.com/image.png",
  "thumbnail": "https://example.com/thumb.png",
  "fields": [
    {
      "name": "Field Name",
      "value": "Field value",
      "inline": false
    }
  ]
}
```

## Database Schema

### scheduledMessages
```sql
- id (VARCHAR): Unique message ID
- guildId (VARCHAR): Guild ID
- channelId (VARCHAR): Channel ID
- creatorId (VARCHAR): User ID who created it
- content (TEXT): Plain text message
- embedData (JSONB): Embed data JSON
- scheduledFor (TIMESTAMP): One-time send time
- cronExpression (VARCHAR): Recurring cron expression
- isRecurring (BOOLEAN): Is this a recurring message
- isActive (BOOLEAN): Is the message currently active
- lastSentAt (TIMESTAMP): Last time message was sent
- createdAt (TIMESTAMP): Creation timestamp
```

### scheduledMessagesConfig
```sql
- guildId (VARCHAR): Guild ID (primary key)
- enabled (BOOLEAN): Module enabled for this guild
- maxScheduledPerGuild (INTEGER): Max allowed per guild (default 25)
- timezone (VARCHAR): Timezone for scheduling
- createdAt (TIMESTAMP)
- updatedAt (TIMESTAMP)
```

## Implementation Details

### Scheduler
- Checks for due messages every 30 seconds
- One-time messages are automatically deactivated after sending
- Recurring messages update `lastSentAt` and continue running
- Automatically deactivates messages if channel is deleted

### Error Handling
- Channel not found: Message is deactivated
- No send permissions: Message is skipped (can be retried)
- Invalid cron: Message is deactivated
- Database errors: Logged and handled gracefully

### Events
Emits `auditLog` events with action `SCHEDULED_MESSAGE_SENT` when messages are successfully sent.

## Permissions

All commands require `ManageGuild` permission (staff only).

## Configuration Example

```
/scheduleconfig set enabled:true
/scheduleconfig set maxScheduledPerGuild:50
/scheduleconfig set timezone:EST
```

## Limits

- Default max 25 scheduled messages per guild (configurable)
- Cron check interval: 30 seconds
- Supported cron: standard 5-field format only
- Max 1000 scheduled messages per guild (hard limit)

## Module Integration

The module is automatically initialized with the bot:

```typescript
const module = new ScheduledMessagesModule(client, db);
await module.loadCommands();
await module.initialize();
```

Commands are registered with the command handler and the scheduler starts automatically.

## Notes

- All times are in UTC unless timezone is configured
- One-time messages must be scheduled for future times
- Cron expressions use server timezone
- Recurring messages continue indefinitely until deleted or disabled
- Message IDs are auto-generated (format: `sm_timestamp_randomstring`)
