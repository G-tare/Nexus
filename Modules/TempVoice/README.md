# TempVoice Module

A comprehensive Discord bot module for creating and managing temporary voice channels that auto-delete when empty.

## Features

### User Features
- **Create Temporary Voice Channels** (`/vc`) - Join a creator channel to automatically create a personal temp VC
- **Rename Channels** (`/vcname`) - Customize your temporary voice channel name
- **Set User Limits** (`/vclimit`) - Control how many users can join your channel
- **Lock/Unlock Channels** (`/vclock`) - Restrict access to your temp VC
- **Permit/Deny Users** (`/vcpermit`) - Allow or deny specific users from joining
- **Kick Users** (`/vckick`) - Remove users from your channel
- **View Channel Info** (`/vcinfo`) - Display details about your temp VC

### Staff Features
- **Module Configuration** (`/vcconfig`) - Configure all module settings
- **Ban Users** (`/vcban`) - Prevent users from creating temp VCs
- **Unban Users** (`/vcunban`) - Restore creation privileges
- **Force Close Channels** (`/vcforceclose`) - Admin-level channel closure

### Automatic Management
- **Auto-Delete Empty Channels** - Channels are deleted after being empty for a configurable time
- **Inactivity Timeout** - Optional: delete channels with no activity after X minutes
- **Periodic Cleanup** - Background process checks for orphaned channels every 60 seconds
- **Voice State Tracking** - Automatic user movement and channel state management

## Configuration

### Module Settings (`/vcconfig`)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enabled` | Boolean | `true` | Enable/disable the module |
| `creatorChannelId` | Snowflake | `null` | Voice channel users join to create temp VCs |
| `categoryId` | Snowflake | `null` | Category where temp VCs are created |
| `maxVCs` | Integer | `10` | Maximum temp VCs per server |
| `cooldownSeconds` | Integer | `30` | Cooldown between creating temp VCs |
| `defaultUserLimit` | Integer | `0` | Default user limit (0 = unlimited) |
| `deleteAfterEmpty` | Integer | `60` | Seconds before deleting empty channel |
| `inactivityTimeout` | Integer | `0` | Minutes of inactivity before deletion (0 = disabled) |
| `nameTemplate` | String | `"{user}'s Channel"` | Template for channel names |
| `bitrate` | Integer | `64000` | Audio bitrate in bps |
| `bannedUsers` | Array | `[]` | User IDs banned from creating temp VCs |

### Setup Instructions

1. **Enable the Module**
   ```
   /vcconfig enable
   ```

2. **Set Creator Channel**
   ```
   /vcconfig creator [voice-channel]
   ```
   This is the channel users join to create temp VCs.

3. **Set Category**
   ```
   /vcconfig category [category]
   ```
   Temporary VCs will be created here.

4. **Configure Optional Settings**
   ```
   /vcconfig maxvcs 15
   /vcconfig cooldown 20
   /vcconfig deleteempty 30
   /vcconfig inactivity 120
   ```

## Command Details

### User Commands

#### `/vc` - Create Temporary Voice Channel
Creates a new temporary voice channel and moves the user to it.
- **Permissions**: None (staff can restrict per guild)
- **Cooldown**: Configurable (default 30 seconds)
- **Requirements**:
  - Module enabled
  - Creator channel configured
  - User not banned
  - User doesn't already own a temp VC
  - Guild hasn't reached max temp VCs

#### `/vcname [name]` - Rename Channel
Renames your temporary voice channel.
- **Permissions**: Owner only
- **Max Length**: 100 characters

#### `/vclimit [limit]` - Set User Limit
Sets the maximum number of users who can join.
- **Range**: 0-99 (0 = unlimited)
- **Permissions**: Owner only

#### `/vclock [lock|unlock]` - Lock/Unlock
Prevents new users from joining (unless permitted).
- **Permissions**: Owner only

#### `/vcpermit [permit|deny] [user]` - Manage Permissions
Allow or deny specific users to join a locked channel.
- **Permissions**: Owner only
- **Actions**:
  - `permit` - Allow user to join locked channel
  - `deny` - Prevent user from joining

#### `/vckick [user]` - Kick User
Removes a user from your temporary voice channel.
- **Permissions**: Owner only

#### `/vcinfo` - View Channel Info
Displays detailed information about your temp VC.
- **Shows**: Owner, members, creation time, lock status, permitted/denied users

### Staff Commands

#### `/vcconfig view` - View Configuration
Displays all current module settings.
- **Permissions**: Manage Channels

#### `/vcconfig enable/disable` - Enable/Disable Module
Toggles the module on/off.
- **Permissions**: Manage Channels

#### `/vcconfig creator [channel]` - Set Creator Channel
Sets the voice channel users join to create temp VCs.
- **Permissions**: Manage Channels

#### `/vcconfig category [category]` - Set Category
Sets where temp VCs are created.
- **Permissions**: Manage Channels

#### `/vcconfig maxvcs [count]` - Set Max VCs
Sets maximum simultaneous temp VCs.
- **Permissions**: Manage Channels
- **Range**: 1-100

#### `/vcconfig cooldown [seconds]` - Set Cooldown
Sets cooldown between channel creations.
- **Permissions**: Manage Channels
- **Range**: 0-3600 seconds

#### `/vcconfig deleteempty [seconds]` - Set Delete After Empty
Sets how long before empty channels are deleted.
- **Permissions**: Manage Channels
- **Range**: 0-3600 seconds

#### `/vcconfig inactivity [minutes]` - Set Inactivity Timeout
Sets automatic deletion after no activity.
- **Permissions**: Manage Channels
- **Range**: 0-1440 minutes (0 = disabled)

#### `/vcban [user] [reason]` - Ban User
Prevents a user from creating temp VCs.
- **Permissions**: Manage Channels

#### `/vcunban [user]` - Unban User
Restores temp VC creation privileges.
- **Permissions**: Manage Channels

#### `/vcforceclose [channel] [reason]` - Force Close
Admin-level closure of any temp VC.
- **Permissions**: Manage Channels

## How It Works

### Creation Flow
1. User joins the configured creator channel
2. Bot checks if user is banned, has cooldown, or already has a temp VC
3. Bot creates new voice channel in configured category
4. User is moved to the new channel
5. Channel record is stored in database
6. Creation cooldown is applied to user
7. Inactivity timer starts (if configured)

### Deletion Flow
1. **Empty Channel**: When last user leaves, 60-second timer starts
   - If no one joins in 60 seconds, channel is deleted
   - If someone joins, timer is cancelled

2. **Inactivity**: Disabled by default
   - If enabled, channel deleted after X minutes with no voice activity
   - Activity = users joining/leaving/speaking

3. **Manual**: Owner can delete by leaving empty, staff can force close

### Permission Management
- Locked channels only allow owner + permitted users
- Denied users cannot join even if channel is unlocked
- Owner can manage both lists independently

### Cleanup Process
- Runs every 60 seconds
- Checks all temp VC records against actual channels
- Removes orphaned records (channel doesn't exist)
- Deletes empty channels with no scheduled deletion
- Handles all errors gracefully

## Database Schema

### tempVoiceChannels Table
```typescript
interface TempVCRecord {
  id: string;                    // guildId-channelId
  guildId: string;              // Server ID
  channelId: string;            // Voice channel ID
  ownerId: string;              // User who created it
  createdAt: Date;              // Creation timestamp
  lockedBy?: string[];          // User IDs with lock permission
  permittedUsers?: string[];    // Users allowed in locked channel
  deniedUsers?: string[];       // Users denied from channel
}
```

## Architecture

### Files
- **helpers.ts** - Database operations, config access, permission helpers, cooldown management
- **events.ts** - Voice state update handlers for automatic channel management
- **cleanup.ts** - Background cleanup manager for orphaned channels
- **core/** - User-facing commands
- **staff/** - Administrator commands
- **index.ts** - Module loader and initializer

### Data Storage
Uses in-memory storage in this implementation. For production, integrate with:
- MongoDB/PostgreSQL for temp VC records
- Guild config system for module settings
- User cooldown cache (Redis recommended)

### Event Handling
- `voiceStateUpdate` - Core event for all voice channel activity
- Automatic channel creation on creator join
- Automatic deletion timer on leave
- Inactivity timer management
- Orphan detection on periodic cleanup

## Error Handling

The module handles:
- Missing permissions (safe failures)
- Channel deletion failures (logs and continues)
- User not found (graceful degradation)
- Database errors (try-catch with logging)
- Race conditions (proper state checks)
- Configuration not set (clear error messages)

## Performance Considerations

- In-memory database: ~1MB per 1000 temp VC records
- Cleanup interval: 60 seconds
- Cooldown cache: Minimal memory
- Event handlers: Async non-blocking
- Timeout management: Proper cleanup

## Integration

To use this module in your bot:

```typescript
import tempVoiceModule from './Modules/TempVoice';

// Load commands
const commands = tempVoiceModule.loadCommands();

// Initialize module (in client ready event)
tempVoiceModule.initializeModule(client);

// Unload when needed
tempVoiceModule.unloadModule();
```

## Future Enhancements

- Persistent database integration
- Channel analytics and statistics
- Custom permissions system
- Transfer ownership command
- Whitelist/blacklist support
- Mobile app integration
- Advanced channel templates
