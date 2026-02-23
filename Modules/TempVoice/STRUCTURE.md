# TempVoice Module Structure

Complete implementation of a temporary voice channel management system for Discord bots.

## Directory Layout

```
TempVoice/
├── core/                       # User-facing commands
│   ├── vc.ts                  # /vc - Create a temp voice channel
│   ├── vcname.ts              # /vcname - Rename your temp VC
│   ├── vclimit.ts             # /vclimit - Set user limit
│   ├── vclock.ts              # /vclock - Lock/unlock your VC
│   ├── vcpermit.ts            # /vcpermit - Allow/deny specific users
│   ├── vckick.ts              # /vckick - Kick someone from your VC
│   └── vcinfo.ts              # /vcinfo - Show info about your temp VC
│
├── staff/                      # Administrator commands
│   ├── config.ts              # /vcconfig - Module settings & configuration
│   ├── ban.ts                 # /vcban - Ban user from creating temp VCs
│   ├── unban.ts               # /vcunban - Unban user from temp VCs
│   └── forceclose.ts          # /vcforceclose - Force close a temp VC
│
├── helpers.ts                 # Core utilities and database operations
├── events.ts                  # Voice state update event handlers
├── cleanup.ts                 # Automatic cleanup manager
├── index.ts                   # Module loader and initializer
├── README.md                  # User and admin documentation
└── STRUCTURE.md              # This file
```

## File Descriptions

### Core Commands (core/)

#### vc.ts (271 lines)
Creates a temporary voice channel for the user.
- Checks module enabled status
- Validates user not banned or on cooldown
- Creates channel in category with config settings
- Records channel ownership in database
- Sets inactivity timer if configured

#### vcname.ts (68 lines)
Renames the user's temporary voice channel.
- Verifies user owns the channel
- Updates channel name
- Logs audit event

#### vclimit.ts (74 lines)
Sets user limit for the channel.
- Validates range (0-99)
- Updates channel configuration
- Records old/new limits in audit log

#### vclock.ts (95 lines)
Locks or unlocks the channel.
- Lock: Denies Connect for everyone except owner
- Unlock: Removes the permission override
- Updates database lock status

#### vcpermit.ts (121 lines)
Permits or denies specific users from joining locked channel.
- Permit: Adds user to allowed list and sets permissions
- Deny: Adds user to denied list and removes permissions
- Maintains separate lists for flexibility

#### vckick.ts (82 lines)
Kicks a user from the channel.
- Verifies user is channel owner
- Checks target is in the channel
- Disconnects user with reason

#### vcinfo.ts (89 lines)
Displays detailed channel information.
- Shows owner, member count, creation time
- Displays lock status
- Lists permitted and denied users
- Shows upload duration

### Staff Commands (staff/)

#### config.ts (352 lines)
Comprehensive configuration command with 9 subcommands.

**Subcommands:**
- `view` - Display all current settings
- `enable`/`disable` - Toggle module
- `creator` - Set creator voice channel
- `category` - Set category for temp VCs
- `maxvcs` - Set max channels (1-100)
- `cooldown` - Set creation cooldown (0-3600s)
- `deleteempty` - Set empty deletion time (0-3600s)
- `inactivity` - Set inactivity timeout (0-1440m)

**Features:**
- Permission checks (ManageChannels required)
- Input validation
- Formatted responses with current values
- Audit logging for all changes

#### ban.ts (68 lines)
Bans a user from creating temporary voice channels.
- Checks user not already banned
- Adds to module's banned list
- Records reason in audit log
- Prevents banned users from creating channels

#### unban.ts (60 lines)
Removes ban from user.
- Verifies user is actually banned
- Removes from banned list
- Audit logged

#### forceclose.ts (95 lines)
Force closes any temporary voice channel.
- Verifies it's actually a temp VC
- Deletes the channel
- Removes database record
- Full audit trail with owner and reason

### Helper Module (helpers.ts) - 398 lines

**Data Structures:**
- `TempVCConfig` - Module configuration interface
- `TempVCRecord` - Temp VC database record
- `DEFAULT_CONFIG` - Default settings

**Database Operations:**
- `createTempVC()` - Add channel record
- `getTempVCByChannelId()` - Lookup by channel
- `getUserTempVC()` - Find user's active channel
- `getGuildTempVCs()` - Get all channels in guild
- `deleteTempVC()` - Remove record
- `updateTempVC()` - Modify existing record

**Configuration:**
- `getConfig()` - Get guild configuration
- `saveConfig()` - Update guild configuration

**User Management:**
- `isUserBanned()` - Check ban status
- `banUser()` - Add to banned list
- `unbanUser()` - Remove from banned list

**Cooldown Management:**
- `isOnCooldown()` - Check cooldown active
- `getCooldownRemaining()` - Seconds until cooldown expires
- `setCooldown()` - Start cooldown timer
- `clearCooldown()` - Remove cooldown

**Scheduling:**
- `scheduleDeletion()` - Queue channel deletion
- `cancelDeletion()` - Cancel deletion schedule
- `scheduleInactivityTimeout()` - Queue inactivity deletion
- `cancelInactivityTimeout()` - Cancel inactivity timer

**Permissions:**
- `lockChannel()` - Add Connect deny for everyone
- `unlockChannel()` - Remove the deny
- `permitUser()` - Allow user in locked channel
- `denyUser()` - Prevent user from joining
- `removeDeny()` - Clear user override

**Utilities:**
- `formatChannelName()` - Apply name template
- `auditLog()` - Log significant events

### Events Module (events.ts) - 280 lines

**Main Function:**
- `handleVoiceStateUpdate()` - Routes voice events to handlers

**Event Handlers:**
- `handleUserJoined()` - User joins any channel
  - Detects creator channel join → creates temp VC
  - Detects temp VC join → cancels deletion, starts inactivity timer
  
- `handleCreatorChannelJoin()` - Specialized creator join handler
  - Ban check
  - Cooldown check
  - Duplicate channel check
  - Max channels check
  - Creates channel with name template
  - Applies all config settings
  - Starts timers

- `handleUserLeft()` - User leaves channel
  - Checks if empty
  - Schedules deletion if empty
  - Cancels inactivity timer

- `handleUserSwitched()` - User changes channels
  - Treats as leave + join

**Registration:**
- `registerVoiceEvents()` - Attaches event listener

### Cleanup Module (cleanup.ts) - 117 lines

**Class:** `TempVCCleanupManager`

**Methods:**
- `constructor()` - Initialize with client
- `start()` - Begin periodic cleanup
- `stop()` - Stop cleanup loop
- `runCleanup()` - Execute single cycle
- `cleanupGuildChannels()` - Process one guild
  - Checks if channel still exists
  - Removes orphaned records
  - Deletes empty channels
  - Handles all errors

- `forceCleanupChannel()` - Manual cleanup command
  - Force delete specific channel
  - Remove record
  - Audit log

**Features:**
- 60-second interval
- Per-guild processing
- Error recovery
- Orphan detection
- Safe deletion

### Module Loader (index.ts) - 80 lines

**Exports:**
- `loadCommands()` - Returns all 11 commands
- `initializeModule()` - Setup events & cleanup
- `unloadModule()` - Cleanup shutdown
- `getCleanupManager()` - Access cleanup system

**Initialization:**
- Registers voice state events
- Creates cleanup manager
- Starts periodic checking
- Loads all commands
- Error handling

## Key Features

### Automatic Management
- Creation on special channel join
- Deletion when empty (configurable delay)
- Inactivity timeouts (optional)
- Periodic orphan cleanup
- Permission-based access control

### User Experience
- Simple one-join creation workflow
- Full customization of owned channels
- Selective permission management
- Real-time information display
- Automatic cleanup (transparent to users)

### Admin Control
- Comprehensive configuration system
- User banning with reasons
- Force channel closure
- Full audit logging
- Flexible cooldown and limits

### Robustness
- Comprehensive error handling
- Database consistency checks
- Permission validation
- Event handler safety
- Timeout management
- Orphan detection

### Scalability
- In-memory storage (upgradable to DB)
- Efficient event handling
- Batch cleanup process
- Per-guild configuration
- Concurrent channel support (configurable max)

## Integration Points

1. **Command Registration** - Export from `index.ts` as BotCommand array
2. **Event Registration** - Called in client ready event
3. **Database Layer** - Replace Map storage in helpers.ts
4. **Configuration System** - Integrate with guild config
5. **Audit System** - Connect auditLog calls to logging service
6. **Permission System** - Already uses PermissionFlagsBits

## Customization Points

- **Naming Templates** - Configurable channel name format
- **Limits** - Max VCs, cooldown, bitrate all configurable
- **Deletion Timing** - Empty channel and inactivity timeouts
- **Permissions** - Lock/permit/deny system
- **Banning** - Per-user creation restrictions
- **Audit Logging** - All significant actions recorded

## Statistics

- **Total Lines of Code**: ~2000+ (production-ready)
- **Commands**: 11 (7 user, 4 staff)
- **Database Records**: TempVCRecord (auto-managed)
- **Configuration Options**: 10 settings
- **Event Handlers**: 1 primary + 4 routes
- **Helper Functions**: 30+
- **Error Handling**: Comprehensive throughout

## Testing Recommendations

1. Test creator channel join workflow
2. Test empty channel auto-deletion
3. Test inactivity timeout
4. Test permission system (lock/permit/deny)
5. Test cooldown system
6. Test max VCs limit
7. Test ban system
8. Test staff commands
9. Test cleanup manager
10. Test error scenarios (missing guild, invalid channels)
