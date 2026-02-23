# Scheduled Messages Module - Implementation Summary

## Module Structure

```
ScheduledMessages/
├── README.md                 # Module documentation
├── IMPLEMENTATION_SUMMARY.md # This file
├── index.ts                  # Module main entry point & initialization
├── helpers.ts                # DB operations & utility functions
├── scheduler.ts              # Message scheduler & sender
├── events.ts                 # Event handlers & audit logging
└── staff/
    ├── schedule.ts           # /schedule command
    ├── schedulelist.ts        # /schedulelist command
    ├── scheduleedit.ts        # /scheduleedit command
    ├── scheduledelete.ts      # /scheduledelete command
    └── config.ts              # /scheduleconfig command
```

## File Overview

### index.ts (Module Entry Point)
- **Class**: `ScheduledMessagesModule`
- **Methods**:
  - `loadCommands()`: Load all command files
  - `getCommands()`: Get loaded commands collection
  - `initialize()`: Initialize module, create tables, start scheduler
  - `shutdown()`: Gracefully shutdown the module
  - `getMetadata()`: Get module information
- **Responsibilities**:
  - Command loading and registration
  - Database table creation (with proper foreign keys)
  - Scheduler initialization
  - Event registration

### helpers.ts (Utilities & DB)
- **Cron Functions**:
  - `isValidCron()`: Validate cron expression syntax
  - `getNextFireTime()`: Calculate next execution time from cron
  - `formatCron()`: Format cron for display
  - `parseSimpleInterval()`: Convert "2h", "30m", "1d" to cron

- **Embed Functions**:
  - `buildEmbed()`: Create Discord EmbedBuilder from options
  - `embedToJSON()`: Convert EmbedBuilder to JSON for storage

- **Validation & Formatting**:
  - `validateScheduledMessage()`: Validate message data before save
  - `formatNextFireTime()`: Get readable "time until fire" string

- **Types**:
  - `ScheduledMessage`: Database record interface
  - `EmbedOptions`: Embed configuration interface

### scheduler.ts (Scheduler Service)
- **Class**: `ScheduledMessageScheduler`
- **Methods**:
  - `start()`: Start 30-second interval checker
  - `stop()`: Stop the scheduler
  - `checkAndSendMessages()`: Fetch and send due messages
  - `sendMessage()`: Send individual message to Discord
  - `deactivateMessage()`: Mark message as inactive

- **Features**:
  - 30-second check interval
  - Automatic channel validation
  - Permission verification
  - Automatic deactivation of one-time messages
  - Error recovery and logging
  - Audit log event emission

### events.ts (Event Handlers)
- **Functions**:
  - `registerScheduledMessagesEvents()`: Register event listeners
  
- **Handled Events**:
  - `auditLog`: Log scheduled message sends to audit table

### staff/schedule.ts (/schedule Command)
- **Type**: One-time and recurring message creation
- **Subcommands**: None (single command with type option)
- **Options**:
  - channel (required, text channel)
  - type (required, once|recurring)
  - datetime (conditional, one-time only)
  - cron (optional, recurring)
  - interval (optional, recurring)
  - message (optional, text content)
  - embed (optional, JSON embed)

- **Features**:
  - Guild limit checking
  - DateTime parsing (ISO + relative)
  - Cron validation
  - Embed validation
  - Auto-generated message ID
  - Response with scheduled time & ID

### staff/schedulelist.ts (/schedulelist Command)
- **Type**: View scheduled messages
- **Options**:
  - filter (optional, all|active|inactive)

- **Features**:
  - Status indicator (✅ active, ⏸️ inactive)
  - Type indicator (📅 one-time, 🔄 recurring)
  - Next fire time calculation
  - Content preview (60 chars)
  - Pagination buttons
  - Footer with usage tips

### staff/scheduleedit.ts (/scheduleedit Command)
- **Type**: Modify scheduled messages
- **Options** (all optional):
  - id (required, message ID)
  - channel
  - message
  - embed
  - datetime (one-time)
  - cron (recurring)
  - interval (recurring)
  - active (enable/disable)

- **Features**:
  - Message existence check
  - Guild-scoped queries
  - Partial updates
  - Embed validation
  - DateTime validation
  - Update count in response

### staff/scheduledelete.ts (/scheduledelete Command)
- **Type**: Remove scheduled messages
- **Options**:
  - id (required, message ID)

- **Features**:
  - Confirmation embed with message details
  - Button-based confirmation UI
  - Danger button styling
  - 30-second timeout for interaction
  - User-scoped buttons (only requester can confirm)
  - Soft-delete friendly (no cascade deletes)

### staff/config.ts (/scheduleconfig Command)
- **Subcommands**:
  - `view`: Show current guild configuration
  - `set`: Update specific setting

- **Configurable Settings**:
  - `enabled` (boolean): Module enabled flag
  - `maxScheduledPerGuild` (1-1000): Max active messages
  - `timezone` (UTC, EST, CST, etc): Scheduling timezone

- **Features**:
  - Config table upsert with conflict handling
  - Timezone validation
  - Integer range validation
  - Default values if not configured
  - Audit logging of config changes

## Database Schema

### scheduledMessages
```sql
CREATE TABLE scheduledMessages (
  id VARCHAR(255) PRIMARY KEY,
  guildId VARCHAR(255) NOT NULL,
  channelId VARCHAR(255) NOT NULL,
  creatorId VARCHAR(255) NOT NULL,
  content TEXT,
  embedData JSONB,
  scheduledFor TIMESTAMP,
  cronExpression VARCHAR(255),
  isRecurring BOOLEAN DEFAULT false,
  isActive BOOLEAN DEFAULT true,
  lastSentAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (guildId) REFERENCES guilds(id) ON DELETE CASCADE
);

CREATE INDEX idx_scheduled_messages_guild 
  ON scheduledMessages(guildId);
CREATE INDEX idx_scheduled_messages_active 
  ON scheduledMessages(guildId, isActive);
```

### scheduledMessagesConfig
```sql
CREATE TABLE scheduledMessagesConfig (
  guildId VARCHAR(255) PRIMARY KEY,
  enabled BOOLEAN DEFAULT true,
  maxScheduledPerGuild INTEGER DEFAULT 25,
  timezone VARCHAR(50) DEFAULT 'UTC',
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (guildId) REFERENCES guilds(id) ON DELETE CASCADE
);
```

## Key Features

### 1. Cron Expression Support
- Full 5-field cron format: `minute hour day month dayOfWeek`
- Validation with regex
- Next fire time calculation up to 1 year ahead
- Support for wildcards (*), ranges (-), steps (/), lists (,)

### 2. Simple Intervals
- Shorthand syntax: "2h", "30m", "1d", etc
- Automatically converted to cron expressions
- No complex cron knowledge required

### 3. Message Content Types
- Plain text messages
- Discord embeds with full customization
- Embed validation before save
- JSON-based embed storage

### 4. Scheduler
- Non-blocking 30-second interval checks
- Efficient: Only fetches active messages
- Auto-deactivates after one-time send
- Continues recurring messages indefinitely

### 5. Error Resilience
- Channel deletion detection
- Permission verification
- Graceful message deactivation
- Comprehensive error logging
- Fallback for missing config

### 6. Guild Configuration
- Per-guild limits (default 25 messages)
- Enable/disable module per guild
- Timezone support for scheduling
- Upsert pattern for config updates

## Permission Model

- **Permission Required**: `ManageGuild` (staff only)
- **Per-guild**: All data is guild-scoped
- **Admin-level**: Only server admins can configure scheduling

## Integration Points

### Required Dependencies
- discord.js 14+ (for interactions, embeds, buttons)
- PostgreSQL or similar (for DB queries)
- Custom logger utility
- Custom types (BotCommand interface)

### Client Setup
```typescript
const module = new ScheduledMessagesModule(client, db);
await module.loadCommands();
await module.initialize();
```

### Command Registration
Commands are returned from `module.getCommands()` and should be registered with the main command handler.

## Performance Considerations

- **Indexes**: Optimized for guild and active status queries
- **Check Interval**: 30 seconds is reasonable - balances responsiveness vs CPU
- **Foreign Keys**: Cascade delete on guild removal
- **Query Limits**: Max 25 results in list command
- **Batch Processing**: Scheduler processes multiple messages in single interval

## Security & Validation

- Guild ID validation on all queries (prevent cross-guild access)
- User ID validation for deletion confirmation (button filter)
- Cron expression validation (prevent regex DoS)
- Embed JSON validation before storage
- Permission checks before sending
- Channel type validation (text only)

## Testing Recommendations

1. Test cron expressions with various formats
2. Test datetime parsing (ISO + relative)
3. Test one-time message auto-deactivation
4. Test recurring message continuation
5. Test channel deletion handling
6. Test permission denied scenarios
7. Test embed JSON validation
8. Test guild limits enforcement
9. Test timezone conversion
10. Test scheduler interval (check logs at 30s marks)

## Future Enhancement Ideas

- Message templates with variable substitution
- Bulk scheduling operations
- Message retry on failure
- Skip/reset scheduler via command
- Analytics on scheduled message delivery
- Advanced cron UI builder
- Timezone conversion for display
- Message preview in list command
- Scheduled message statistics
- Integration with other modules
