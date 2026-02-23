# Invite Tracker Module - Complete File Index

## Overview
The Invite Tracker module is a complete, production-ready invite tracking system for Discord bots built with discord.js v14 and TypeScript.

## File Structure and Descriptions

### Core Implementation Files

#### `/index.ts` (Module Entry Point)
- **Purpose**: Registers the module with the bot's module loader
- **Exports**: Default Module object with all commands and events
- **Contains**:
  - Module metadata (name, displayName, category, version)
  - Command imports and registration
  - Event imports and registration
  - Module configuration schema for dashboard
  - Lifecycle hooks (onLoad, onUnload)
- **Key Exports**: Module interface with 6 commands and 5 events

#### `/helpers.ts` (Core Logic - ~450 lines)
- **Purpose**: All business logic, database queries, and utilities
- **Interfaces**:
  - `InviteConfig`: Guild-specific settings
  - `InviteData`: Individual invite record structure
  - `InviterStats`: Statistics for an inviter
  - `TopInviter`: Leaderboard entry
- **Configuration Functions**:
  - `getInviteConfig()`: Get config with defaults and caching
- **Cache Functions**:
  - `cacheGuildInvites()`: Cache all current invites
  - `findUsedInvite()`: Find which code was used
- **Recording Functions**:
  - `recordInvite()`: Record a new invite
  - `recordLeave()`: Record member leaving
  - `checkFakeInvite()`: Check account age
  - `markInviteAsFake()`: Flag and adjust counts
- **Statistics Functions**:
  - `getInviterStats()`: Get total/real/leaves/fakes/bonus
  - `getInviterStatsInPeriod()`: Get invites in X days (CRITICAL)
  - `getInvitedBy()`: Find who invited a user
  - `getTopInviters()`: Get top inviters for leaderboard
- **Bonus Functions**:
  - `addBonusInvites()`: Award bonus invites
  - `removeBonusInvites()`: Remove bonus invites
- **Reset Functions**:
  - `resetInvites()`: Reset one or all users
- **Builder Functions**:
  - `buildInvitesEmbed()`: Create stats embed
  - `buildLeaderboardEmbed()`: Create leaderboard embed
  - `logInviteEvent()`: Log events to channel

#### `/events.ts` (Discord Event Handlers - ~250 lines)
- **Purpose**: Handle Discord.js events related to invites
- **Handlers**:
  1. `inviteCacheHandler` - ClientReady: Cache invites on startup
  2. `inviteCreateHandler` - InviteCreate: Update cache
  3. `inviteDeleteHandler` - InviteDelete: Update cache
  4. `memberJoinHandler` - GuildMemberAdd: Track new invites
  5. `memberLeaveHandler` - GuildMemberRemove: Track leaves
- **Exports**: Array of BotEvent objects

### Commands - Core Functionality

#### `/core/invites.ts`
- **Command**: `/invites [user] [days]`
- **Purpose**: Check invite count for self or another user
- **Options**:
  - `user`: Optional, defaults to command author
  - `days`: Optional, filter to last X days
- **Response**: Embed showing real/total/leaves/fakes/bonus invites
- **Permissions**: Anyone (premium feature required)

#### `/core/leaderboard.ts`
- **Command**: `/invite-leaderboard [page] [days]`
- **Purpose**: View top 10 inviters with medals
- **Options**:
  - `page`: Optional pagination (default: 1)
  - `days`: Optional time filter
- **Response**: Embed with top 10 inviters, 🥇🥈🥉 medals for top 3
- **Permissions**: Anyone (premium feature required)

#### `/core/who-invited.ts`
- **Command**: `/who-invited <user>`
- **Purpose**: See who invited a specific user
- **Options**:
  - `user`: Required, user to check
- **Response**: Embed with inviter, code, join date, fake status
- **Permissions**: Anyone (premium feature required)

### Commands - Staff Configuration

#### `/staff/config.ts`
- **Command**: `/invite-config <subcommand>`
- **Purpose**: Configure invite tracking per guild
- **Subcommands**:
  - `view`: Show all current settings
  - `toggle`: Enable/disable tracking
  - `track-leaves`: Toggle leave tracking
  - `track-fakes`: Toggle fake detection
  - `fake-age`: Set account age threshold (days)
  - `fake-leave-hours`: Set leave threshold (hours)
  - `log-channel`: Set logging channel
  - `announce`: Configure join announcements
- **Permissions**: ManageGuild required
- **Storage**: JSONB in guild_settings.config

#### `/staff/reset.ts`
- **Command**: `/invite-reset <subcommand>`
- **Purpose**: Reset invite counts
- **Subcommands**:
  - `user`: Reset one user's invites
  - `all`: Reset all invites (requires button confirmation)
- **Permissions**: ManageGuild required
- **Safety**: Confirmation button for /reset all

#### `/staff/bonus.ts`
- **Command**: `/invite-bonus <subcommand>`
- **Purpose**: Manage bonus invites
- **Subcommands**:
  - `add`: Award bonus invites (1-1000)
  - `remove`: Remove bonus invites
  - `view`: Check user's bonus count
- **Permissions**: ManageGuild required
- **Validation**: Max 1000 per operation

## Documentation Files

### `/README.md`
- **Purpose**: Quick reference guide
- **Contents**:
  - Feature overview
  - Quick start steps
  - Command reference
  - API functions list
  - Data storage info
  - Integration points
  - Events emitted
  - Configuration defaults
  - Performance notes
  - Troubleshooting

### `/SETUP.md`
- **Purpose**: Step-by-step installation guide
- **Sections**:
  - Database setup
  - Module registration
  - Permission requirements
  - Redis configuration
  - Event bus setup
  - Per-guild configuration
  - Complete testing checklist
  - Troubleshooting guide
  - Performance tuning
  - Backup/recovery procedures

### `/INTEGRATION.md`
- **Purpose**: How to integrate with other modules
- **Sections**:
  - Integration with Moderation (userinfo)
  - Integration with Giveaways
  - Event system documentation
  - Data structure reference
  - Configuration storage
  - Time-filtered views explanation
  - Cache system details
  - Commands overview

### `/EXAMPLES.md`
- **Purpose**: Real-world code examples
- **Examples**:
  1. Moderation userinfo integration
  2. Giveaways invite requirements
  3. Giveaway embed with requirements
  4. Event handling patterns
  5. Auto-role based on invites
  6. Export statistics to CSV
  7. Milestone notifications
  8. Period-specific leaderboard
  9. Advanced requirement verification
  10. Utility functions

### `/SCHEMA.sql`
- **Purpose**: Database schema
- **Contents**:
  - guild_members column additions
  - invite_records table creation
  - All necessary indexes
  - guild_settings config column
  - Sample config structure

### `/INDEX.md`
- **Purpose**: This file - complete reference
- **Contents**: Detailed description of every file

## Database Tables

### guild_members Table
**New/Modified Columns:**
- `invites`: INTEGER (count of real invites)
- `bonus_invites`: INTEGER (staff-awarded bonus)
- `invited_by`: UUID (who invited this user)

**Indexes:**
- `idx_guild_members_invites`
- `idx_guild_members_invited_by`

### invite_records Table
**Columns:**
- `id`: UUID (primary key)
- `guild_id`: BIGINT (Discord guild ID)
- `inviter_id`: BIGINT (Discord user ID of inviter)
- `user_id`: BIGINT (Discord user ID of invited)
- `code`: VARCHAR (invite code used)
- `joined_at`: TIMESTAMP (when they joined)
- `left_at`: TIMESTAMP (when they left, NULL if still member)
- `is_fake`: BOOLEAN (flagged as suspicious)
- `created_at`: TIMESTAMP (record creation)

**Indexes:**
- Primary key on `id`
- Composite: `(guild_id, inviter_id)`
- Composite: `(guild_id, user_id)`
- Single: `joined_at`, `left_at`, `is_fake`
- Unique: `(guild_id, user_id, code)`

### guild_settings Table
**New/Modified Columns:**
- `config`: JSONB (stores invitetracker config)

**Indexes:**
- GIN index on `config` for JSONB queries

## Redis Cache Keys

- `inviteconfig:{guildId}` - Configuration (1h TTL)
- `inviterstats:{guildId}:{userId}` - Stats (1h TTL)
- `invites:cache:{guildId}:{code}` - Current uses (no TTL)
- `guildinvites:{guildId}` - Guild invite cache (no TTL)

## Events Emitted

### inviteTracked
```typescript
{
  guildId: string;
  inviterId: string;
  joinedUserId: string;
  code: string;
  timestamp: Date;
}
```

### inviteLeft
```typescript
{
  guildId: string;
  inviterId: string;
  userId: string;
  timestamp: Date;
}
```

### bonusInvitesAdded
```typescript
{
  guildId: string;
  userId: string;
  count: number;
}
```

### bonusInvitesRemoved
```typescript
{
  guildId: string;
  userId: string;
  count: number;
}
```

### invitesReset
```typescript
{
  guildId: string;
  userId?: string; // Only if resetting one user
}
```

## Command Statistics

- **Total Commands**: 6
- **Public Commands**: 3 (require premium feature)
- **Staff Commands**: 3 (require ManageGuild)
- **Subcommands**: 13 total
  - config: 8 subcommands
  - reset: 2 subcommands
  - bonus: 3 subcommands

## Code Statistics

- **TypeScript Files**: 8 (.ts)
- **Documentation Files**: 5 (.md)
- **Database Schema**: 1 (.sql)
- **Total Lines of Code**: ~1500+ lines
- **helpers.ts**: ~450 lines (most complex)
- **events.ts**: ~250 lines
- **Each command**: 50-150 lines

## Testing Checklist Items

- Member join tracking
- Leaderboard display
- Fake detection
- Leave tracking
- Bonus invites
- Reset functionality
- Configuration persistence
- Event emissions
- Time-filtered queries
- Integration with other modules

## Key Features

✅ Full invite tracking system
✅ Real-time statistics
✅ Time-filtered views (crucial for giveaways)
✅ Fake detection (new accounts)
✅ Leave tracking (reduces count)
✅ Bonus invites (staff award)
✅ Leaderboard system
✅ Event emissions
✅ Redis caching
✅ Database persistence
✅ Configuration system
✅ Logging and announcements
✅ Full TypeScript support
✅ discord.js v14 compatible

## Integration Points

1. **Moderation Module**: userinfo command shows "Invited by"
2. **Giveaways Module**: Query invite counts for requirements
3. **Custom Modules**: Use eventBus for real-time updates
4. **Dashboard**: Configuration through module config
5. **Analytics**: Export data via helper functions

## Configuration Schema

```typescript
interface InviteConfig {
  enabled: boolean;                  // Master switch
  trackJoins: boolean;              // Track who invited who
  trackLeaves: boolean;             // Track when they leave
  trackFakes: boolean;              // Detect suspicious accounts
  fakeAccountAgeDays: number;       // Account age threshold
  fakeLeaveHours: number;           // Leave time threshold
  logChannelId?: string;            // Log channel
  announceJoins: boolean;           // Announce joins
  announceChannelId?: string;       // Announce channel
}
```

## File Locations

Base Path: `/sessions/relaxed-brave-curie/mnt/Bot 2026/Modules/InviteTracker/`

All files are in this directory or subdirectories:
- `core/` - Public commands
- `staff/` - Staff commands

## Version Information

- **Module Version**: 1.0.0
- **Discord.js Version**: v14
- **TypeScript**: Full support
- **Node.js**: 14+ required

## Support Resources

1. README.md - Quick reference
2. SETUP.md - Installation guide
3. INTEGRATION.md - Integration with other modules
4. EXAMPLES.md - Code examples
5. This file - Complete file reference

---

Generated: 2026-02-22
Module: Invite Tracker v1.0.0
