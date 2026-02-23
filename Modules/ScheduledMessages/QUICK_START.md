# Scheduled Messages Module - Quick Start Guide

## Installation

1. Ensure the module is in: `/mnt/Bot 2026/Modules/ScheduledMessages/`
2. The module requires:
   - discord.js 14+
   - PostgreSQL database
   - Custom logger utility at `../../../utils/logger`
   - BotCommand type at `../../../types/command`

## Initialize the Module

```typescript
import ScheduledMessagesModule from './Modules/ScheduledMessages';
import { Client } from 'discord.js';

const client = new Client({ intents: [...] });
const db = // your database instance

// Initialize module
const scheduledMessagesModule = new ScheduledMessagesModule(client, db);
await scheduledMessagesModule.loadCommands();
await scheduledMessagesModule.initialize();

// Register commands with your command handler
const commands = scheduledMessagesModule.getCommands();
commands.forEach(command => {
  commandHandler.set(command.data.name, command);
});
```

## Basic Usage Examples

### Create a One-Time Message
```
/schedule channel:#announcements type:once datetime:2h message:Server maintenance in 2 hours!
```

### Create a Daily Recurring Message
```
/schedule channel:#daily type:recurring cron:"0 9 * * *" message:Good morning everyone!
```

### Create a Weekly Reminder
```
/schedule channel:#reminders type:recurring interval:1d message:Weekly standup at 9 AM
```

### View All Scheduled Messages
```
/schedulelist filter:all
```

### View Only Active Messages
```
/schedulelist filter:active
```

### Edit a Scheduled Message
```
/scheduleedit id:sm_1234567890_abc123 message:New message text
```

### Edit Schedule Time
```
/scheduleedit id:sm_1234567890_abc123 datetime:1h
```

### Edit to Recurring
```
/scheduleedit id:sm_1234567890_abc123 cron:"0 9 * * 1"
```

### Disable a Message
```
/scheduleedit id:sm_1234567890_abc123 active:false
```

### Delete a Message
```
/scheduledelete id:sm_1234567890_abc123
```

### Configure Guild Settings
```
/scheduleconfig view
/scheduleconfig set setting:maxScheduledPerGuild value:50
/scheduleconfig set setting:timezone value:EST
```

## Common Cron Expressions

| Schedule | Cron Expression |
|----------|-----------------|
| Every day at 9 AM | `0 9 * * *` |
| Every Monday at 9 AM | `0 9 * * 1` |
| Every hour | `0 * * * *` |
| Every 30 minutes | `*/30 * * * *` |
| Every 6 hours | `0 */6 * * *` |
| Midnight daily | `0 0 * * *` |
| First day of month | `0 0 1 * *` |
| Business days at 2 PM | `0 14 * * 1-5` |

## Relative DateTime Examples

| Example | Effect |
|---------|--------|
| `30m` | In 30 minutes |
| `1h` | In 1 hour |
| `2h30m` | ⚠️ Not supported, use minutes (150m) |
| `1d` | In 1 day |
| `3d` | In 3 days |
| `2025-12-31T15:30` | ISO format (exact date/time) |

## Embed JSON Example

```json
{
  "title": "Important Announcement",
  "description": "This is an important message for all members.",
  "color": "#00aa00",
  "footer": "Sent automatically",
  "image": "https://example.com/image.png",
  "thumbnail": "https://example.com/thumb.png",
  "fields": [
    {
      "name": "Date",
      "value": "February 22, 2026",
      "inline": true
    },
    {
      "name": "Status",
      "value": "Active",
      "inline": true
    }
  ]
}
```

Pass as: `/schedule ... embed:{...json string...}`

## Database Setup

The module auto-creates tables on initialization:

```sql
-- Automatically created by module.initialize()
CREATE TABLE scheduledMessages (
  id VARCHAR(255) PRIMARY KEY,
  guildId VARCHAR(255),
  channelId VARCHAR(255),
  creatorId VARCHAR(255),
  content TEXT,
  embedData JSONB,
  scheduledFor TIMESTAMP,
  cronExpression VARCHAR(255),
  isRecurring BOOLEAN DEFAULT false,
  isActive BOOLEAN DEFAULT true,
  lastSentAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT NOW()
);

CREATE TABLE scheduledMessagesConfig (
  guildId VARCHAR(255) PRIMARY KEY,
  enabled BOOLEAN DEFAULT true,
  maxScheduledPerGuild INTEGER DEFAULT 25,
  timezone VARCHAR(50) DEFAULT 'UTC',
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

## File Locations

All files are in: `/sessions/relaxed-brave-curie/mnt/Bot 2026/Modules/ScheduledMessages/`

```
├── index.ts                    # Module class
├── helpers.ts                  # 260 lines - Cron, embeds, validation
├── scheduler.ts                # 140 lines - Message scheduler
├── events.ts                   # 30 lines - Event handlers
├── staff/
│   ├── schedule.ts             # 220 lines - Create messages
│   ├── schedulelist.ts         # 140 lines - List messages
│   ├── scheduleedit.ts         # 200 lines - Edit messages
│   ├── scheduledelete.ts       # 150 lines - Delete with confirmation
│   └── config.ts               # 200 lines - Guild settings
├── README.md                   # Full documentation
├── IMPLEMENTATION_SUMMARY.md   # Technical details
└── QUICK_START.md             # This file
```

## Troubleshooting

### Messages not sending
1. Check bot has `Send Messages` permission in channel
2. Verify cron expression syntax
3. Check scheduler is running: `GET /moduleinfo/scheduledmessages`
4. Check logs for permission errors

### Invalid cron error
- Must be 5-field format: `minute hour day month dayOfWeek`
- Each field separated by space
- Valid ranges: 0-59 (min), 0-23 (hour), 1-31 (day), 1-12 (month), 0-6 (dow)

### Guild limit reached
- Default is 25 messages per guild
- Delete inactive messages or increase limit:
  ```
  /scheduleconfig set setting:maxScheduledPerGuild value:50
  ```

### Embed validation fails
- Ensure JSON is valid and properly formatted
- All color values must be hex codes (e.g., `#0099ff`)
- Image/thumbnail URLs must be valid HTTP(S) URLs

### Messages still active after send
- One-time messages should auto-deactivate
- Check database: `SELECT isActive FROM scheduledMessages WHERE id='...'`
- If stuck, manually disable: `/scheduleedit id:... active:false`

## Performance Notes

- Scheduler checks every 30 seconds
- Recommended max 500 total messages across all guilds
- One-time messages are auto-deactivated (saves space)
- Recurring messages continue indefinitely
- Database indexes optimize guild-scoped queries

## Security Notes

- Only users with `ManageGuild` permission can use commands
- All queries are guild-scoped (no cross-guild access)
- Deletion requires user confirmation (button interaction)
- Messages use guild's bot permissions (respects channel overwrites)

## Next Steps

1. Ensure database tables are created
2. Test with a simple one-time message
3. Test recurring message with cron
4. Verify scheduler is running (check logs)
5. Test embed message creation
6. Configure guild settings as needed

## Support

For issues or questions:
1. Check the logs for error messages
2. Review IMPLEMENTATION_SUMMARY.md for technical details
3. Verify database tables exist and are accessible
4. Ensure all imports and dependencies are available
