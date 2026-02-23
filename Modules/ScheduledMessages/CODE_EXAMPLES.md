# Scheduled Messages Module - Code Examples

## Module Initialization Example

```typescript
import { Client } from 'discord.js';
import ScheduledMessagesModule from './Modules/ScheduledMessages';

async function setupBot(client: Client, db: any) {
  // Initialize the Scheduled Messages module
  const scheduledModule = new ScheduledMessagesModule(client, db);
  
  // Load all commands from the module
  await scheduledModule.loadCommands();
  
  // Initialize (creates tables, starts scheduler)
  await scheduledModule.initialize();
  
  // Get all commands and register with your command handler
  const commands = scheduledModule.getCommands();
  
  commandHandler.registerCollection(commands);
  
  // Get module metadata
  const metadata = scheduledModule.getMetadata();
  console.log(`Module: ${metadata.name} v${metadata.version}`);
  console.log(`Commands: ${metadata.commands}`);
  console.log(`Scheduler: ${metadata.scheduler}`);
}
```

## Creating One-Time Messages Programmatically

```typescript
// Via Discord command (recommended)
/schedule channel:#announcements type:once datetime:2h message:"Important announcement!"

// Programmatic approach (if needed)
async function scheduleOneTimeMessage(
  db: any,
  guildId: string,
  channelId: string,
  userId: string,
  message: string,
  scheduleTime: Date
) {
  const id = `sm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await db.query(
    `INSERT INTO scheduledMessages 
     (id, guildId, channelId, creatorId, content, scheduledFor, isRecurring, isActive, createdAt)
     VALUES ($1, $2, $3, $4, $5, $6, false, true, NOW())`,
    [id, guildId, channelId, userId, message, scheduleTime]
  );
  
  return id;
}
```

## Creating Recurring Messages with Cron

```typescript
// Daily at 9 AM
/schedule channel:#daily type:recurring cron:"0 9 * * *" message:"Good morning!"

// Every Monday at 2 PM
/schedule channel:#weekly type:recurring cron:"0 14 * * 1" message:"Weekly standup!"

// Every 30 minutes
/schedule channel:#frequent type:recurring cron:"*/30 * * * *" message:"Checkpoint!"

// First of every month at midnight
/schedule channel:#billing type:recurring cron:"0 0 1 * *" message:"Monthly billing cycle starts"

// Business days at 9 AM
/schedule channel:#work type:recurring cron:"0 9 * * 1-5" message:"Work day starts!"
```

## Using Simple Intervals

```typescript
// Every 2 hours
/schedule channel:#hourly type:recurring interval:2h message:"Update message"

// Every 30 minutes
/schedule channel:#frequent type:recurring interval:30m message:"Check-in"

// Once daily
/schedule channel:#daily type:recurring interval:1d message:"Daily summary"

// Every 3 days
/schedule channel:#weekly type:recurring interval:3d message:"3-day report"
```

## Creating Messages with Embeds

```typescript
// Embed JSON format
const embedJson = {
  "title": "Server Status Report",
  "description": "Current server health metrics",
  "color": "#00aa00",
  "footer": "Auto-generated report",
  "fields": [
    {
      "name": "Uptime",
      "value": "99.9%",
      "inline": true
    },
    {
      "name": "Members",
      "value": "1,234",
      "inline": true
    },
    {
      "name": "Channels",
      "value": "56",
      "inline": true
    }
  ]
};

/schedule channel:#reports type:recurring interval:1d embed:{...json...}
```

## Managing Scheduled Messages

```typescript
// List all scheduled messages
/schedulelist filter:all

// List only active messages
/schedulelist filter:active

// List only inactive messages (disabled or expired)
/schedulelist filter:inactive

// Edit message content
/scheduleedit id:sm_1234567890_abc123 message:"New message text"

// Edit recurring schedule
/scheduleedit id:sm_1234567890_abc123 cron:"0 10 * * *"

// Change to different interval
/scheduleedit id:sm_1234567890_abc123 interval:2h

// Disable temporarily (without deleting)
/scheduleedit id:sm_1234567890_abc123 active:false

// Re-enable disabled message
/scheduleedit id:sm_1234567890_abc123 active:true

// Move message to different channel
/scheduleedit id:sm_1234567890_abc123 channel:#new-channel

// Delete message (with confirmation)
/scheduledelete id:sm_1234567890_abc123
```

## Configuration Examples

```typescript
// View current configuration
/scheduleconfig view

// Enable module (if previously disabled)
/scheduleconfig set setting:enabled value:true

// Increase guild limit to 100 messages
/scheduleconfig set setting:maxScheduledPerGuild value:100

// Set timezone to Eastern Time
/scheduleconfig set setting:timezone value:EST

// Reduce limit to conserve resources
/scheduleconfig set setting:maxScheduledPerGuild value:10

// Disable module for this guild
/scheduleconfig set setting:enabled value:false
```

## Working with Cron Expressions

### Basic Pattern
```
minute (0-59) hour (0-23) day (1-31) month (1-12) dayOfWeek (0-6, 0=Sunday)
```

### Examples

**Every hour at minute 0:**
```
0 * * * *
```

**Every day at 9 AM:**
```
0 9 * * *
```

**Every Monday at 9 AM:**
```
0 9 * * 1
```

**Every 15 minutes:**
```
*/15 * * * *
```

**Every 6 hours:**
```
0 */6 * * *
```

**Business days (Monday-Friday) at 9 AM:**
```
0 9 * * 1-5
```

**First day of month at midnight:**
```
0 0 1 * *
```

**Last day of month (approximately):**
```
0 0 31 * *
```

**Multiple times (9 AM, 2 PM, 6 PM):**
```
0 9,14,18 * * *
```

## Relative DateTime Examples

```typescript
// In 5 minutes
/schedule ... datetime:5m ...

// In 30 minutes
/schedule ... datetime:30m ...

// In 1 hour
/schedule ... datetime:1h ...

// In 2 hours
/schedule ... datetime:2h ...

// In 1 day
/schedule ... datetime:1d ...

// In 7 days (1 week)
/schedule ... datetime:7d ...

// ISO format (exact date/time)
/schedule ... datetime:2025-12-31T15:30 ...
```

## Database Query Examples

```sql
-- Get all active messages in a guild
SELECT * FROM scheduledMessages 
WHERE guildId = 'guild_id' AND isActive = true;

-- Get all recurring messages
SELECT * FROM scheduledMessages 
WHERE isRecurring = true;

-- Get messages that haven't been sent yet
SELECT * FROM scheduledMessages 
WHERE isRecurring = false AND scheduledFor > NOW();

-- Get guild configuration
SELECT * FROM scheduledMessagesConfig 
WHERE guildId = 'guild_id';

-- Count active messages per guild
SELECT guildId, COUNT(*) as active_count 
FROM scheduledMessages 
WHERE isActive = true 
GROUP BY guildId;

-- Find overdue one-time messages
SELECT * FROM scheduledMessages 
WHERE isRecurring = false 
  AND isActive = true 
  AND scheduledFor < NOW();
```

## Error Handling Examples

```typescript
// Invalid cron expression
/schedule ... cron:"invalid" ...
// Result: "❌ Invalid cron expression. Format: minute hour day month dayOfWeek"

// Datetime in the past
/schedule ... datetime:2025-01-01T12:00 ...
// Result: "❌ Scheduled time must be in the future."

// No content provided
/schedule channel:#test type:once datetime:1h
// Result: "❌ You must provide either a message or embed data."

// Guild limit reached
/schedule ... (if already 25 messages)
// Result: "❌ Guild limit reached (25 active scheduled messages). Delete some first."

// Invalid embed JSON
/schedule ... embed:"{invalid json}" ...
// Result: "❌ Invalid embed JSON format."

// Message not found
/scheduleedit id:nonexistent ...
// Result: "❌ Scheduled message not found."
```

## Event Handling

```typescript
// The module emits audit log events when messages are sent
client.on('auditLog', (auditData) => {
  if (auditData.action === 'SCHEDULED_MESSAGE_SENT') {
    console.log(`Message sent in guild: ${auditData.guildId}`);
    console.log(`Details: ${auditData.details}`);
  }
});

// Example audit data structure:
{
  action: 'SCHEDULED_MESSAGE_SENT',
  guildId: '123456789',
  userId: '987654321',
  target: 'sm_1234567890_abc123',
  details: 'Scheduled message sent to 345678901'
}
```

## Advanced Patterns

### Message Templates (Manual Implementation)

```typescript
// Create a message template
const template = {
  title: "Daily Report for {{date}}",
  description: "Summary of {{server_name}}",
  fields: [
    {
      name: "Members Online",
      value: "{{online_count}}"
    }
  ]
};

// Would need to be processed before sending
// (Module doesn't include template processing)
```

### Scheduled Message Statistics

```typescript
// Query to get scheduled message stats
SELECT 
  guildId,
  COUNT(*) as total_messages,
  SUM(CASE WHEN isRecurring = true THEN 1 ELSE 0 END) as recurring_count,
  SUM(CASE WHEN isRecurring = false THEN 1 ELSE 0 END) as onetime_count,
  SUM(CASE WHEN isActive = true THEN 1 ELSE 0 END) as active_count
FROM scheduledMessages
GROUP BY guildId
ORDER BY total_messages DESC;
```

### Message Cleanup

```typescript
-- Remove all inactive one-time messages older than 30 days
DELETE FROM scheduledMessages 
WHERE isRecurring = false 
  AND isActive = false 
  AND createdAt < NOW() - INTERVAL '30 days';

-- Remove inactive messages older than 90 days
DELETE FROM scheduledMessages 
WHERE isActive = false 
  AND createdAt < NOW() - INTERVAL '90 days';

-- Reset recurring message sent times
UPDATE scheduledMessages 
SET lastSentAt = NULL 
WHERE isRecurring = true 
  AND creatorId = 'user_id';
```

## Testing the Scheduler

```typescript
// Test 1: Create a one-time message for 1 minute from now
/schedule channel:#test type:once datetime:1m message:"Test message"
// Should send automatically after ~30-60 seconds

// Test 2: Create a recurring message every minute (for testing only!)
/schedule channel:#test type:recurring cron:"* * * * *" message:"Recurring test"
// Should send every minute

// Test 3: Create message with embed
/schedule channel:#test type:once datetime:2m 
  embed:"{\"title\":\"Test\",\"description\":\"Embed test\"}"

// Test 4: Verify scheduler is running
// Check logs for: "[ScheduledMessages] Scheduler started"
// Check logs every 30 seconds for: "Sent message" entries

// Test 5: Verify auto-deactivation
/schedulelist filter:inactive
// Should show the one-time test messages after they send
```

All examples use the Discord slash commands as the primary interface.
Programmatic examples are for advanced use cases only.
