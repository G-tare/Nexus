# Invite Tracker Module - Integration Guide

## Overview
The Invite Tracker module provides invite tracking functionality that integrates with other modules in your Discord bot.

## Critical Connections

### 1. Moderation Module (userinfo command)
The userinfo command should display "Invited by: @user" using data from this module.

**How to integrate:**
In your Moderation module's userinfo command, add this code:

```typescript
import { getInvitedBy } from '../InviteTracker/helpers';

// In userinfo command execution:
const invitedBy = await getInvitedBy(interaction.guildId!, targetUser.id);

if (invitedBy) {
  const inviter = await interaction.client.users.fetch(invitedBy.inviterId);
  embed.addFields({
    name: 'Invited By',
    value: `${inviter} (joined <t:${Math.floor(invitedBy.joinedAt.getTime() / 1000)}:f>)`,
  });
} else {
  embed.addFields({
    name: 'Invited By',
    value: 'Unknown',
  });
}
```

### 2. Giveaways Module
The giveaways module should query invite counts from this module for invite requirements.

**How to integrate:**
In your Giveaways module, import and use these functions:

```typescript
import {
  getInviterStatsInPeriod,
  getInviterStats,
} from '../InviteTracker/helpers';

// For requirement: "5 invites in last 7 days"
const invitesInPeriod = await getInviterStatsInPeriod(
  guildId,
  userId,
  7 // days
);

if (invitesInPeriod >= 5) {
  // User meets requirement
}

// For requirement: "10 total invites"
const totalStats = await getInviterStats(guildId, userId);

if (totalStats.real >= 10) {
  // User meets requirement
}
```

## Event System

This module emits events to the eventBus when important actions occur:

### Emitted Events

#### `inviteTracked`
Fired when an invite is successfully recorded.
```typescript
eventBus.on('inviteTracked', (data) => {
  console.log(`${data.joinedUserId} was invited by ${data.inviterId}`);
  // data: { guildId, inviterId, joinedUserId, code, timestamp }
});
```

#### `inviteLeft`
Fired when an invited user leaves the server.
```typescript
eventBus.on('inviteLeft', (data) => {
  console.log(`${data.userId} left the server`);
  // data: { guildId, inviterId, userId, timestamp }
});
```

#### `bonusInvitesAdded`
Fired when bonus invites are added to a user.
```typescript
eventBus.on('bonusInvitesAdded', (data) => {
  console.log(`Added ${data.count} bonus invites to ${data.userId}`);
  // data: { guildId, userId, count }
});
```

#### `bonusInvitesRemoved`
Fired when bonus invites are removed from a user.
```typescript
eventBus.on('bonusInvitesRemoved', (data) => {
  console.log(`Removed ${data.count} bonus invites from ${data.userId}`);
  // data: { guildId, userId, count }
});
```

#### `invitesReset`
Fired when invites are reset.
```typescript
eventBus.on('invitesReset', (data) => {
  if (data.userId) {
    console.log(`Reset invites for ${data.userId}`);
  } else {
    console.log(`Reset all invites in guild ${data.guildId}`);
  }
  // data: { guildId, userId? }
});
```

## Data Structure

### guild_members Table
- `invites` (INTEGER): Total number of real invites
- `bonus_invites` (INTEGER): Bonus invites added by staff
- `invited_by` (UUID): ID of the user who invited them

### invite_records Table
Stores detailed information about each invite:
- `id` (UUID): Unique identifier
- `guild_id` (BIGINT): Guild ID
- `inviter_id` (BIGINT): User ID of the person who invited
- `user_id` (BIGINT): User ID of the person who joined
- `code` (VARCHAR): Invite code used
- `joined_at` (TIMESTAMP): When they joined
- `left_at` (TIMESTAMP, nullable): When they left (if applicable)
- `is_fake` (BOOLEAN): Whether marked as fake/suspicious
- `created_at` (TIMESTAMP): Record creation timestamp

## Configuration

Configuration is stored in `guild_settings.config.invitetracker`:

```typescript
interface InviteConfig {
  enabled: boolean;
  trackJoins: boolean;              // Track who invited who
  trackLeaves: boolean;             // Track when invited members leave
  trackFakes: boolean;              // Detect fake invites
  fakeAccountAgeDays: number;       // Accounts younger than this = fake
  fakeLeaveHours: number;           // If they leave within X hours = fake
  logChannelId?: string;            // Log channel ID
  announceJoins: boolean;           // Announce "User joined!"
  announceChannelId?: string;       // Announce channel ID
}
```

## Time-Filtered Views

The module supports time-filtered invite counts for giveaway requirements.

**Function:** `getInviterStatsInPeriod(guildId, userId, days)`

Example:
```typescript
// Get invites in the last 7 days
const recentInvites = await getInviterStatsInPeriod(guildId, userId, 7);

// This is critical for giveaway requirements like:
// "5 invites in last 7 days"
if (recentInvites >= 5) {
  console.log('User meets requirement');
}
```

## Premium Feature

This module uses the `invitetracker.basic` premium feature flag. All commands require this premium feature to be enabled for the guild.

## Cache System

The module uses Redis for caching:
- `inviteconfig:{guildId}` - Cached configuration (1 hour TTL)
- `inviterstats:{guildId}:{userId}` - Cached stats (1 hour TTL)
- `invites:cache:{guildId}:{code}` - Current invite uses for tracking

Caches are automatically invalidated when data changes.

## Required Database Migrations

Run `SCHEMA.sql` to create necessary tables and columns.

## Commands Overview

### Core Commands (Public)
- `/invites [user] [days]` - Check invite count
- `/invite-leaderboard [page] [days]` - View top inviters
- `/who-invited <user>` - See who invited someone

### Staff Commands (Requires ManageGuild)
- `/invite-config view` - View settings
- `/invite-config toggle` - Enable/disable
- `/invite-config track-leaves` - Toggle leave tracking
- `/invite-config track-fakes` - Toggle fake detection
- `/invite-config fake-age` - Set account age threshold
- `/invite-config fake-leave-hours` - Set leave threshold
- `/invite-config log-channel` - Set log channel
- `/invite-config announce` - Toggle announcements

- `/invite-reset user <user>` - Reset user's invites
- `/invite-reset all` - Reset all invites (confirmation required)

- `/invite-bonus add <user> <amount>` - Add bonus invites
- `/invite-bonus remove <user> <amount>` - Remove bonus invites
- `/invite-bonus view <user>` - View user's bonus invites
