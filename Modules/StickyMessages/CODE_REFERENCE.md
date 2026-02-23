# Sticky Messages Module - Code Reference

## Core Classes and Interfaces

### ActivityTracker (tracker.ts)

```typescript
class ActivityTracker {
  recordMessage(channelId: string): void
  getActivityLevel(channelId: string): 'low' | 'medium' | 'high'
  getThreshold(
    channelId: string, 
    baseInterval: number,
    mode: 'interval' | 'activity' | 'hybrid'
  ): number
  cleanup(channelId: string): void
  cleanupAll(): void
}
```

**Usage**:
```typescript
import { activityTracker } from './tracker';

// Record a message in a channel
activityTracker.recordMessage(channelId);

// Get current activity level
const level = activityTracker.getActivityLevel(channelId);
// Returns: 'low' | 'medium' | 'high'

// Calculate threshold based on mode
const threshold = activityTracker.getThreshold(channelId, 5, 'hybrid');
// Returns: adjusted threshold value
```

### StickyMessagesHelper (helpers.ts)

```typescript
class StickyMessagesHelper {
  // Sticky Message Operations
  createStickyMessage(
    guildId: string,
    channelId: string,
    content: string,
    embedData: APIEmbed | null,
    interval: number,
    priority?: number
  ): Promise<StickyMessageRecord>

  getStickyMessage(stickyId: string): Promise<StickyMessageRecord | null>
  getStickyMessagesByChannel(channelId: string): Promise<StickyMessageRecord[]>
  getStickyMessagesByGuild(guildId: string): Promise<StickyMessageRecord[]>

  updateStickyMessage(
    stickyId: string,
    updates: Partial<StickyMessageRecord>
  ): Promise<StickyMessageRecord>

  deleteStickyMessage(stickyId: string): Promise<void>
  deactivateStickyMessage(stickyId: string): Promise<StickyMessageRecord>

  incrementMessagesSince(stickyId: string): Promise<StickyMessageRecord>
  resetMessagesSince(stickyId: string): Promise<StickyMessageRecord>

  // Configuration Operations
  getGuildConfig(guildId: string): Promise<StickyConfig>
  updateGuildConfig(guildId: string, config: Partial<StickyConfig>): Promise<StickyConfig>

  // Utility Methods
  buildEmbed(embedData: APIEmbed | null): EmbedBuilder | null
  validateSticky(client: Client, sticky: StickyMessageRecord): Promise<boolean>
}
```

**Usage**:
```typescript
import { StickyMessagesHelper } from './helpers';

const helper = new StickyMessagesHelper(db);

// Create a sticky
const sticky = await helper.createStickyMessage(
  guildId,
  channelId,
  'Welcome message',
  null,
  5, // interval
  0  // priority
);

// Update counter
const updated = await helper.incrementMessagesSince(sticky.id);

// Check if threshold reached
if (updated.messagesSince >= threshold) {
  // Re-stick
}

// Get configuration
const config = await helper.getGuildConfig(guildId);

// Update configuration
await helper.updateGuildConfig(guildId, { mode: 'activity' });
```

### Type Definitions

#### StickyMessageRecord
```typescript
interface StickyMessageRecord {
  id: string;
  guildId: string;
  channelId: string;
  content: string;
  embedData: APIEmbed | null;
  currentMessageId: string | null;
  interval: number;
  messagesSince: number;
  priority: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
```

#### StickyConfig
```typescript
interface StickyConfig {
  enabled: boolean;
  mode: 'interval' | 'activity' | 'hybrid';
  maxStickiesPerChannel: number;
  deleteBotMessage: boolean;
}
```

## Event Handlers (events.ts)

### messageCreate Event
Triggered on every message in a guild.

**Flow**:
1. Record message in activity tracker
2. Get all active stickies for channel
3. For each sticky:
   - Increment messagesSince counter
   - Calculate threshold based on mode and activity
   - If threshold reached and rate limit allows:
     - Delete old message (if enabled)
     - Send new message
     - Reset counter

**Rate Limit**: 5 seconds minimum between re-sticks per message

### messageDelete Event
Triggered when a message is deleted.

**Flow**:
1. Check if deleted message is a sticky
2. If yes and bot has permissions:
   - Clear currentMessageId
   - Resend the sticky message

### channelDelete Event
Triggered when a channel is deleted.

**Flow**:
1. Find all stickies in deleted channel
2. Deactivate each sticky

## Command Structure

All commands follow this pattern:

```typescript
const commandName: BotCommand = {
  module: 'stickymessages',
  permissionPath: 'staff.stickymessages.commandname',
  data: new SlashCommandBuilder()
    // ... builder configuration
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction, db: Database) {
    try {
      await interaction.deferReply({ ephemeral: true });

      // Get options
      const channel = interaction.options.getChannel('channel', true);
      
      // Validate
      if (!channel.isTextBased()) {
        await interaction.editReply({ content: 'Error message' });
        return;
      }

      // Process
      const helper = new StickyMessagesHelper(db);
      const result = await helper.someOperation();

      // Response
      await interaction.editReply({ content: 'Success message' });

      // Audit log
      if (interaction.client.emit) {
        interaction.client.emit('auditLog', {
          type: 'STICKY_ACTION',
          userId: interaction.user.id,
          guildId: interaction.guildId,
          details: { /* ... */ },
        });
      }
    } catch (error) {
      logger.error(`Error: ${error}`);
      await interaction.editReply({ content: 'An error occurred.' });
    }
  },
};

export default commandName;
```

## Module Initialization (index.ts)

```typescript
export const StickyMessagesModule: StickyMessagesModule = {
  commands: [stickCommand, unstickCommand, stickyeditCommand, stickyConfigCommand],

  async initialize(client: Client, db: Database): Promise<void> {
    // Setup event handlers
    registerStickyEventsEvents(client, db);
    // Tracker starts automatically
  },

  async shutdown(): Promise<void> {
    // Cleanup on shutdown
    activityTracker.cleanupAll();
  },
};
```

## Common Patterns

### Pattern 1: Create and Send Sticky
```typescript
const sticky = await helper.createStickyMessage(
  guildId,
  channelId,
  content,
  null,
  interval,
  priority
);

const sentMessage = await channel.send({ content });

await helper.updateStickyMessage(sticky.id, {
  currentMessageId: sentMessage.id,
});
```

### Pattern 2: Re-stick Message
```typescript
const sticky = await helper.getStickyMessage(stickyId);
const updated = await helper.incrementMessagesSince(sticky.id);

const threshold = activityTracker.getThreshold(
  sticky.channelId,
  sticky.interval,
  mode
);

if (updated.messagesSince >= threshold) {
  // Delete old
  await oldMessage.delete();
  
  // Send new
  const newMessage = await channel.send({ content });
  
  // Update DB
  await helper.updateStickyMessage(stickyId, {
    currentMessageId: newMessage.id,
    messagesSince: 0,
  });
}
```

### Pattern 3: Edit Sticky
```typescript
const updates: any = {};
if (newContent) updates.content = newContent;
if (newInterval) updates.interval = newInterval;

const updated = await helper.updateStickyMessage(stickyId, updates);

if (newContent && sticky.currentMessageId) {
  const message = await channel.messages.fetch(sticky.currentMessageId);
  await message.edit({ content: newContent });
}
```

### Pattern 4: Get and List Stickies
```typescript
// Get all in channel
const stickies = await helper.getStickyMessagesByChannel(channelId);

// Stickies are sorted by priority (highest first)
// Access by index (0-based)
const sticky = stickies[index];

// Get configuration
const config = await helper.getGuildConfig(guildId);

// Check if at limit
if (stickies.length >= config.maxStickiesPerChannel) {
  // At limit
}
```

## Error Handling Patterns

### Permission Check
```typescript
const botMember = await interaction.guild!.members.fetchMe();
const permissions = channel.permissionsFor(botMember);

if (!permissions?.has(['SendMessages', 'ManageMessages'])) {
  throw new Error('Missing permissions');
}
```

### Message Fetch with Fallback
```typescript
try {
  const message = await channel.messages.fetch(messageId);
  await message.delete();
} catch (error) {
  // Message already deleted, reset DB
  await helper.updateStickyMessage(stickyId, {
    currentMessageId: null,
    messagesSince: 0,
  });
}
```

### Channel Validation
```typescript
const guild = await client.guilds.fetch(sticky.guildId);
const channel = await guild.channels.fetch(sticky.channelId);

if (!channel?.isTextBased()) {
  await helper.deactivateStickyMessage(sticky.id);
  return;
}
```

## Configuration Management

### Get Current Config
```typescript
const config = await helper.getGuildConfig(guildId);
// Returns with defaults if not set
```

### Update Single Setting
```typescript
await helper.updateGuildConfig(guildId, {
  mode: 'activity'
});
```

### Get and Merge
```typescript
const existing = await helper.getGuildConfig(guildId);
const updated = { ...existing, ...newSettings };
// Both will be applied correctly
```

## Activity Tracking

### Record Message
```typescript
activityTracker.recordMessage(channelId);
// Automatically manages rolling window
```

### Check Activity Level
```typescript
const level = activityTracker.getActivityLevel(channelId);
// Returns: 'low' | 'medium' | 'high'
// Automatically calculated from messages in last minute
```

### Get Adaptive Threshold
```typescript
const threshold = activityTracker.getThreshold(
  channelId,
  5,      // base interval
  'hybrid' // mode
);

if (messagesSince >= threshold) {
  // Re-stick
}
```

## Audit Logging

All major operations emit audit log events:

```typescript
if (interaction.client.emit) {
  interaction.client.emit('auditLog', {
    type: 'STICKY_CREATED',
    userId: interaction.user.id,
    guildId: interaction.guildId,
    details: {
      stickyId: sticky.id,
      channelId: channel.id,
      interval: interval,
      priority: priority,
    },
  });
}
```

Event types:
- `STICKY_CREATED`
- `STICKY_REMOVED`
- `STICKY_EDITED`
- `STICKY_CONFIG_UPDATED`

