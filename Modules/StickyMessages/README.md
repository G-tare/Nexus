# Sticky Messages Module

A Discord bot module that keeps messages "stuck" to the bottom of a channel by automatically deleting and resending them at regular intervals or based on activity levels.

## Features

- **Sticky Messages**: Keep important messages visible by automatically re-posting them
- **Dual Mode Operation**:
  - **Interval Mode**: Re-stick after a fixed number of messages (default: 5)
  - **Activity-Based Mode**: Adjust re-stick timing based on channel activity
  - **Hybrid Mode**: Combine both approaches
- **Activity Detection**: Intelligently detects channel activity levels
  - Low activity (<1 msg/min): Re-stick after 3 messages
  - Medium activity (1-5 msg/min): Re-stick after 8 messages
  - High activity (>5 msg/min): Re-stick after 15 messages
- **Multiple Stickies**: Support for multiple sticky messages per channel (default max: 3)
- **Priority System**: Control which stickies appear higher
- **Content Updates**: Edit sticky content without removing and recreating
- **Embed Support**: Full support for Discord embeds
- **Rate Limiting**: Prevents spam with 5-second minimum between re-sticks

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS stickyMessages (
  id VARCHAR(255) PRIMARY KEY,
  guildId VARCHAR(255) NOT NULL,
  channelId VARCHAR(255) NOT NULL,
  content TEXT,
  embedData JSONB,
  currentMessageId VARCHAR(255),
  interval INT DEFAULT 5,
  messagesSince INT DEFAULT 0,
  priority INT DEFAULT 0,
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stickyConfigs (
  guildId VARCHAR(255) PRIMARY KEY,
  config JSONB,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Commands

### `/stick <channel> [content] [interval] [priority]`
Create a new sticky message in a channel.

**Parameters**:
- `channel`: Target channel (required)
- `content`: Message content (required)
- `interval`: Re-stick after N messages (1-100, default: 5)
- `priority`: Priority ordering (0-999, default: 0)

**Permissions**: Manage Messages

### `/unstick <channel> [index]`
Remove a sticky message from a channel.

**Parameters**:
- `channel`: Target channel (required)
- `index`: Which sticky to remove (1-indexed, default: 1)

**Permissions**: Manage Messages

### `/stickyedit <channel> <index> [content] [interval] [priority]`
Edit an existing sticky message.

**Parameters**:
- `channel`: Target channel (required)
- `index`: Which sticky to edit (1-indexed, required)
- `content`: New message content (optional)
- `interval`: New re-stick interval (optional)
- `priority`: New priority (optional)

**Permissions**: Manage Messages

### `/stickyconfig view`
View current sticky messages configuration for the guild.

### `/stickyconfig mode <mode>`
Set the re-stick mode: `interval`, `activity`, or `hybrid`.

### `/stickyconfig enabled <enabled>`
Enable or disable sticky messages for the guild.

### `/stickyconfig maxstickies <count>`
Set the maximum number of sticky messages per channel (1-10).

### `/stickyconfig deleteoldmessage <delete>`
Configure whether to delete old sticky messages when resending.

## Architecture

### Files

- **tracker.ts**: ActivityTracker class for monitoring message frequency
- **helpers.ts**: Database operations and configuration management
- **events.ts**: Message event handlers for detecting and re-sticking
- **staff/stick.ts**: Command to create sticky messages
- **staff/unstick.ts**: Command to remove sticky messages
- **staff/stickyedit.ts**: Command to edit sticky messages
- **staff/config.ts**: Command to configure module settings
- **index.ts**: Module initialization and command registration

### Key Components

#### ActivityTracker
Monitors message frequency per channel using a rolling 1-minute window:
- `recordMessage(channelId)`: Track a new message
- `getActivityLevel(channelId)`: Get 'low', 'medium', or 'high'
- `getThreshold(channelId, baseInterval, mode)`: Calculate re-stick threshold

#### StickyMessagesHelper
Handles all database operations:
- Create, read, update, delete sticky messages
- Manage guild configurations
- Build Discord embeds

#### Event Handlers
- `messageCreate`: Track activity and check if re-sticking is needed
- `messageDelete`: Handle deleted sticky messages
- `channelDelete`: Deactivate stickies in deleted channels

## Configuration

Default configuration:
```typescript
{
  enabled: true,
  mode: 'interval',
  maxStickiesPerChannel: 3,
  deleteBotMessage: true
}
```

## Modes Explained

### Interval Mode
- Re-sticks after a fixed number of messages per sticky
- Simple and predictable
- Best for channels with consistent activity

### Activity Mode
- Adjusts threshold based on real-time channel activity
- Smart responses to traffic changes
- Best for mixed-activity channels

### Hybrid Mode
- Uses the configured interval as a minimum
- Scales up based on activity level
- Best for all-purpose usage

## Rate Limiting

Minimum 5 seconds between re-sticks for the same message to prevent spam.

## Error Handling

- Gracefully handles missing permissions
- Automatically deactivates stickies in inaccessible channels
- Recovers from deleted messages
- Validates channels before operations

## Example Usage

```
# Create a sticky welcome message
/stick channel:#general content:"Welcome to our server!" interval:8

# Set guild to activity-based mode
/stickyconfig mode activity

# Edit sticky priority (higher priority appears later)
/stickyedit channel:#general index:1 priority:10

# Configure max 2 stickies per channel
/stickyconfig maxstickies 2

# Remove sticky messages when deleting old ones
/stickyconfig deleteoldmessage true
```

## Permissions Required

The bot needs the following permissions in channels with sticky messages:
- Send Messages
- Manage Messages

## Audit Logging

The module emits audit log events for:
- STICKY_CREATED: When a sticky message is created
- STICKY_REMOVED: When a sticky message is removed
- STICKY_EDITED: When a sticky message is edited
- STICKY_CONFIG_UPDATED: When configuration changes

## Performance Considerations

- Activity tracking uses an in-memory rolling window
- Database queries are optimized with indexes on guildId and channelId
- Rate limiting prevents excessive message operations
- Automatic cleanup on channel deletion
