# Invite Tracker Module

A comprehensive Discord invite tracking system that monitors who invited members, tracks invites over time, and provides leaderboards and statistics.

## Features

- **Invite Tracking**: Automatically tracks which invite code is used when members join
- **Inviter Attribution**: Records who invited each member for future reference
- **Real-time Stats**: Shows total, real, fake, and bonus invites
- **Time-Filtered Views**: Check invites from last X days (critical for giveaway requirements)
- **Leaderboard**: View top inviters with optional time filtering
- **Fake Detection**: Automatically flags new accounts that leave quickly
- **Bonus System**: Staff can manually award bonus invites
- **Logging**: Optional logging of all invite events to a designated channel
- **Announcements**: Optional announcements when members join with inviter info

## Quick Start

### 1. Database Setup
Run `SCHEMA.sql` to create required tables and columns:
```bash
psql -d your_database -f SCHEMA.sql
```

### 2. Module Configuration
The module is automatically registered in `index.ts`. No additional setup needed.

### 3. Configure in Discord
Use `/invite-config` commands to configure per-guild settings.

## Commands

### Public Commands
```
/invites [user] [days]
  Check your or someone else's invite count
  Options:
    - user: User to check (optional, default: you)
    - days: Show invites from last X days (optional)

/invite-leaderboard [page] [days]
  View top 10 inviters (10 per page)
  Options:
    - page: Page number (optional)
    - days: Filter by invites in last X days (optional)

/who-invited <user>
  See who invited a specific user
  Options:
    - user: User to check (required)
```

### Staff Commands (Requires ManageGuild)
```
/invite-config view
  View all current settings

/invite-config toggle <enabled>
  Enable or disable invite tracking

/invite-config track-leaves <enabled>
  Toggle tracking when invited members leave

/invite-config track-fakes <enabled>
  Toggle detection of suspicious invites

/invite-config fake-age <days>
  Set minimum account age before flagging as fake (1-365 days)

/invite-config fake-leave-hours <hours>
  Set hours before a leave is flagged as fake (1-720 hours)

/invite-config log-channel <channel>
  Set channel for logging invite events

/invite-config announce <enabled> [channel]
  Configure join announcements

/invite-reset user <user>
  Reset a specific user's invite count

/invite-reset all
  Reset all invites on the server (confirmation required)

/invite-bonus add <user> <amount>
  Add bonus invites to a user (1-1000)

/invite-bonus remove <user> <amount>
  Remove bonus invites from a user

/invite-bonus view <user>
  View a user's bonus invites
```

## API Functions

### Core Functions

```typescript
// Get invite configuration
const config = await getInviteConfig(guildId);

// Cache all invites in a guild
await cacheGuildInvites(guild);

// Find which invite code was used
const usedCode = await findUsedInvite(guild);

// Record a new invite
await recordInvite(guildId, inviterId, joinedUserId, code);

// Record a member leaving
await recordLeave(guildId, userId);

// Check if an account is fake
const isFake = await checkFakeInvite(member, config);

// Get inviter statistics
const stats = await getInviterStats(guildId, userId);
// Returns: { total, leaves, fakes, bonus, real }

// Get invites in a time period (critical for giveaways!)
const recentInvites = await getInviterStatsInPeriod(guildId, userId, days);

// Get who invited a user
const inviter = await getInvitedBy(guildId, userId);
// Returns: { inviterId, code, joinedAt } or null

// Get top inviters for leaderboard
const topInviters = await getTopInviters(guildId, limit, optionalDays);

// Manage bonus invites
await addBonusInvites(guildId, userId, count);
await removeBonusInvites(guildId, userId, count);

// Reset invites
await resetInvites(guildId, userId); // Reset one user
await resetInvites(guildId); // Reset entire guild
```

### Helper Functions

```typescript
// Build an embed showing invite stats
const embed = buildInvitesEmbed(userId, stats, guild, optionalDays);

// Build a leaderboard embed
const embed = buildLeaderboardEmbed(entries, guildName, page, optionalDays);

// Log an invite event to the log channel
await logInviteEvent(guild, config, eventName, details);
```

## Data Storage

### guild_members Table
- `invites`: Total real invites from this user
- `bonus_invites`: Staff-awarded bonus invites
- `invited_by`: ID of user who invited them

### invite_records Table
Detailed records of each invite:
- `id`: Unique identifier
- `guild_id`: Guild ID
- `inviter_id`: Who invited them
- `user_id`: Who was invited
- `code`: Invite code used
- `joined_at`: Timestamp when they joined
- `left_at`: Timestamp when they left (if applicable)
- `is_fake`: Whether flagged as suspicious

### Redis Cache
- `inviteconfig:{guildId}`: Cached configuration (1 hour TTL)
- `inviterstats:{guildId}:{userId}`: Cached stats (1 hour TTL)
- `invites:cache:{guildId}:{code}`: Current invite uses

## Integration Points

### Moderation Module (userinfo command)
Add this to show who invited a user:
```typescript
import { getInvitedBy } from '../InviteTracker/helpers';

const invitedBy = await getInvitedBy(guildId, userId);
if (invitedBy) {
  embed.addFields({
    name: 'Invited By',
    value: `<@${invitedBy.inviterId}>`,
  });
}
```

### Giveaways Module
Check invite requirements:
```typescript
import { getInviterStatsInPeriod } from '../InviteTracker/helpers';

// For "5 invites in last 7 days" requirement
const recentInvites = await getInviterStatsInPeriod(guildId, userId, 7);
if (recentInvites >= 5) {
  // User meets requirement
}
```

## Events

The module emits events to the eventBus:

- `inviteTracked`: When an invite is recorded
- `inviteLeft`: When an invited user leaves
- `bonusInvitesAdded`: When bonus invites are added
- `bonusInvitesRemoved`: When bonus invites are removed
- `invitesReset`: When invites are reset

## Configuration Defaults

```typescript
{
  enabled: true,
  trackJoins: true,
  trackLeaves: true,
  trackFakes: true,
  fakeAccountAgeDays: 7,      // 7 days old = considered real
  fakeLeaveHours: 24,         // Leave within 24 hours = suspicious
  announceJoins: false,
  trackChannelId: undefined,
  announceChannelId: undefined,
}
```

## Premium Feature

All commands require the `invitetracker.basic` premium feature.

## Error Handling

All functions include error handling. Errors are logged to console but don't break execution. Commands defer replies to give time for queries.

## Performance Considerations

- Invites are cached on startup and updated when changes occur
- Database queries use indexes for fast lookups
- Caches expire after 1 hour or when data changes
- Leaderboard is limited to 10 entries per page

## File Structure

```
InviteTracker/
├── index.ts                 # Module registration
├── helpers.ts               # Core logic and database functions
├── events.ts                # Event handlers
├── core/
│   ├── invites.ts          # /invites command
│   ├── leaderboard.ts      # /invite-leaderboard command
│   └── who-invited.ts      # /who-invited command
├── staff/
│   ├── config.ts           # /invite-config command
│   ├── reset.ts            # /invite-reset command
│   └── bonus.ts            # /invite-bonus command
├── SCHEMA.sql              # Database schema
├── INTEGRATION.md          # Integration guide
└── README.md               # This file
```

## Troubleshooting

### Invites not being tracked
1. Check if module is enabled: `/invite-config view`
2. Verify `trackJoins` is true
3. Ensure bot has permission to fetch invites (`ManageGuild`)
4. Check Redis connection is working

### Fake detection not working
1. Ensure `trackFakes` is enabled
2. Check `fakeAccountAgeDays` setting (default: 7)
3. New accounts are only flagged if account is younger than threshold

### Leaderboard shows no data
1. Members may have just joined - wait for tracking to occur
2. Check if invite records were created: query `invite_records` table
3. Use `/invite-reset all` to clear and start fresh

## Contributing

To extend this module, add new commands to the appropriate folder (`core/` or `staff/`) and export them in `index.ts`.
