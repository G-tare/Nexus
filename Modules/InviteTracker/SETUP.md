# Invite Tracker Module - Setup Guide

## Installation Checklist

### Step 1: Database Setup
1. Run the database schema:
   ```bash
   psql -d your_database_name -f SCHEMA.sql
   ```

2. Verify the tables exist:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name IN ('guild_members', 'invite_records', 'guild_settings');
   ```

3. Check columns were added:
   ```sql
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'guild_members' AND column_name IN ('invites', 'bonus_invites', 'invited_by');
   ```

### Step 2: Module Registration
The module is self-contained. Ensure your bot's module loader includes:
```typescript
// In your module loader
import inviteTrackerModule from './Modules/InviteTracker/index';

// Register it
await moduleLoader.register(inviteTrackerModule);
```

### Step 3: Verify Bot Permissions
Ensure your bot has these permissions in guilds:
- `ManageGuild` - For fetching invites and logging
- `ReadMessages/ViewChannel` - For posting logs and announcements
- `SendMessages` - For sending command responses
- `EmbedLinks` - For sending embeds

### Step 4: Redis Configuration
Verify Redis is configured and accessible:
```typescript
// In your redis client initialization
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  // ... other config
});

// Test connection
const pong = await redis.ping();
console.log(pong); // Should output: PONG
```

### Step 5: Event Bus Setup
Verify eventBus is properly initialized:
```typescript
// In your main bot file
import { eventBus } from './src/events';

// Should emit 'inviteTracked', 'inviteLeft', etc.
eventBus.on('inviteTracked', (data) => {
  console.log('Invite tracked:', data);
});
```

## Configuration

### Per-Guild Settings
After setup, configure each guild using commands:

```
/invite-config view
/invite-config toggle true
/invite-config track-leaves true
/invite-config track-fakes true
/invite-config fake-age 7
/invite-config fake-leave-hours 24
/invite-config log-channel #invite-logs
/invite-config announce true #announcements
```

### Default Configuration
All guilds start with these defaults:
- ✅ Enabled
- ✅ Track joins
- ✅ Track leaves
- ✅ Track fakes
- 7 day account age threshold
- 24 hour leave threshold
- ❌ Announcements disabled

## File Structure

```
InviteTracker/
├── index.ts                          # Module registration
├── helpers.ts                        # Core logic (~450 lines)
│   ├── Interfaces: InviteConfig, InviteData, InviterStats
│   ├── Config functions
│   ├── Cache functions
│   ├── Invite recording functions
│   ├── Statistics functions
│   ├── Reset functions
│   └── Embed builders
├── events.ts                         # Discord event handlers (~250 lines)
│   ├── memberJoinHandler
│   ├── memberLeaveHandler
│   ├── inviteCacheHandler
│   ├── inviteCreateHandler
│   └── inviteDeleteHandler
├── core/
│   ├── invites.ts                   # /invites command
│   ├── leaderboard.ts               # /invite-leaderboard command
│   └── who-invited.ts               # /who-invited command
├── staff/
│   ├── config.ts                    # /invite-config command
│   ├── reset.ts                     # /invite-reset command
│   └── bonus.ts                     # /invite-bonus command
├── SCHEMA.sql                       # Database schema
├── README.md                        # Quick reference
├── INTEGRATION.md                   # How to integrate with other modules
├── EXAMPLES.md                      # Code examples
└── SETUP.md                         # This file
```

## Command Summary

### Public Commands
- `/invites` - Check invite count
- `/invite-leaderboard` - View top inviters
- `/who-invited` - See who invited someone

### Staff Commands (ManageGuild required)
- `/invite-config` - Configure settings
- `/invite-reset` - Reset invite counts
- `/invite-bonus` - Manage bonus invites

## Testing Checklist

### Test 1: Member Join Tracking
1. Have a bot test user join using an invite
2. Check that invite is recorded: `SELECT * FROM invite_records LIMIT 1;`
3. Check `/invites` shows the invite count
4. Run `/who-invited @test-user` to verify

### Test 2: Leaderboard
1. Join with multiple users
2. Run `/invite-leaderboard` - should show top inviters
3. Test with `/invite-leaderboard days:7` - should work

### Test 3: Fake Detection
1. Create a brand new account
2. Have it join the server
3. Check if it's flagged as fake (account age < 7 days by default)
4. Run `/invites @new-user` - fake count should increase

### Test 4: Leave Tracking
1. Have a member leave
2. Run `/invites @inviter` - should show reduced count
3. Check `SELECT * FROM invite_records WHERE left_at IS NOT NULL;`

### Test 5: Bonus Invites
1. Run `/invite-bonus add @user 5`
2. Run `/invite-bonus view @user` - should show 5 bonus
3. Run `/invites @user` - real count should include bonus
4. Run `/invite-bonus remove @user 3`

### Test 6: Reset
1. Run `/invite-reset user @user`
2. Check `/invites @user` - should be 0
3. Run `/invite-reset all` (confirm)
4. All members should have 0 invites

### Test 7: Configuration
1. Run `/invite-config view`
2. Change settings with various toggle commands
3. Verify changes persist (check database)

### Test 8: Event Emissions
1. Check console for event logs
2. Monitor eventBus:
   ```typescript
   eventBus.on('inviteTracked', console.log);
   eventBus.on('inviteLeft', console.log);
   ```

## Troubleshooting

### Issue: "Invite tracking is disabled"
- Run `/invite-config toggle true` to enable
- Check `SELECT * FROM guild_settings WHERE guild_id = YOUR_GUILD_ID;`

### Issue: No invites showing
- Check if members have actually joined via invite
- Verify database has records: `SELECT COUNT(*) FROM invite_records;`
- Check Redis is working: `redis-cli PING`

### Issue: Fake detection not working
- Verify `trackFakes` is true
- Check account creation date vs threshold
- Account must be younger than `fakeAccountAgeDays`

### Issue: Announces not showing
- Set announce channel: `/invite-config announce true #channel`
- Verify bot has SendMessages permission in that channel
- Check logs for errors

### Issue: Stats seem wrong
- Clear cache: `redis-cli FLUSHALL` (careful!)
- Or wait 1 hour for cache to expire
- Verify database records are correct

## Performance Tuning

### For Large Guilds (10k+ members)
1. Increase cache TTL:
   - Edit `helpers.ts` line with `setex(..., 3600, ...)`
   - Change `3600` to `7200` (2 hours) or higher

2. Optimize leaderboard queries:
   - Limit to top 5: `/invite-leaderboard` only shows top 10
   - Use pagination with `page` option

3. Monitor Redis memory:
   ```bash
   redis-cli INFO memory
   ```

### Database Optimization
1. Add more indexes (already in SCHEMA.sql)
2. Vacuum table periodically:
   ```sql
   VACUUM ANALYZE invite_records;
   ```

3. Archive old records (optional):
   ```sql
   -- Archive records older than 1 year
   INSERT INTO invite_records_archive
   SELECT * FROM invite_records WHERE created_at < NOW() - INTERVAL '1 year';

   DELETE FROM invite_records WHERE created_at < NOW() - INTERVAL '1 year';
   ```

## Integration with Other Modules

### With Moderation (userinfo)
See INTEGRATION.md for code example

### With Giveaways
See INTEGRATION.md for code example

### With Custom Modules
See EXAMPLES.md for integration patterns

## API Reference

All functions in `helpers.ts` are exported and can be imported:

```typescript
import {
  getInviteConfig,
  cacheGuildInvites,
  findUsedInvite,
  recordInvite,
  recordLeave,
  checkFakeInvite,
  getInviterStats,
  getInviterStatsInPeriod,
  getInvitedBy,
  getTopInviters,
  addBonusInvites,
  removeBonusInvites,
  resetInvites,
  buildInvitesEmbed,
  buildLeaderboardEmbed,
  logInviteEvent,
} from './Modules/InviteTracker/helpers';
```

## Premium Feature Flag

All commands use: `invitetracker.basic`

Update this in your premium feature system if needed.

## Backup and Recovery

### Backup
```bash
# Backup invite records
pg_dump -t invite_records your_database > invite_records_backup.sql

# Backup guild_members (relevant columns)
pg_dump -t guild_members your_database > guild_members_backup.sql
```

### Restore
```bash
psql your_database < invite_records_backup.sql
psql your_database < guild_members_backup.sql
```

## Support

For issues or questions:
1. Check README.md for quick reference
2. Check INTEGRATION.md for integration help
3. Check EXAMPLES.md for code examples
4. Review troubleshooting section above
5. Check bot console logs for errors

## Version History

- v1.0.0 - Initial release
  - Invite tracking
  - Leaderboards
  - Fake detection
  - Bonus system
  - Full configuration
