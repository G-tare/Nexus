# TempVoice Module - Quick Start Guide

Get the Temp Voice module up and running in 5 minutes.

## Installation

1. Copy the entire `TempVoice/` folder to `/Modules/`
2. Import in your main bot file:

```typescript
import tempVoiceModule from './Modules/TempVoice';

// In your command loading function
const tempVoiceCommands = tempVoiceModule.loadCommands();
botCommands.push(...tempVoiceCommands);

// In your client ready event
tempVoiceModule.initializeModule(client);
```

## Initial Setup (5 steps)

### Step 1: Create Channels
Create two Discord channels:
- **Creator Channel** - A voice channel users will join to create temp VCs
- **Category** - A channel category where temp VCs will be created

### Step 2: Enable Module
```
/vcconfig enable
```

### Step 3: Set Creator Channel
```
/vcconfig creator <creator-voice-channel>
```
Replace `<creator-voice-channel>` with the voice channel from Step 1.

### Step 4: Set Category
```
/vcconfig category <category>
```
Replace `<category>` with the category from Step 1.

### Step 5: Verify Configuration
```
/vcconfig view
```
Should show:
- ✅ Enabled: Yes
- ✅ Creator Channel: Set
- ✅ Category: Set

## Basic Usage

### For Users

1. **Create a temp VC**
   - Join the creator voice channel
   - Bot automatically creates a temp VC and moves you there

2. **Customize your channel**
   - `/vcname` - Rename your channel
   - `/vclimit` - Set user limit
   - `/vclock lock` - Prevent others from joining
   - `/vckick` - Remove users
   - `/vcinfo` - View channel details

3. **Leave your channel**
   - When last person leaves, channel auto-deletes after 60 seconds
   - If someone joins within 60 seconds, channel stays

### For Admins

1. **Monitor the module**
   ```
   /vcconfig view
   ```

2. **Ban a problematic user**
   ```
   /vcban <user> <reason>
   ```

3. **Force close a channel**
   ```
   /vcforceclose <channel> <reason>
   ```

4. **Adjust settings**
   ```
   /vcconfig cooldown 20        # Change cooldown
   /vcconfig maxvcs 20          # Increase max channels
   /vcconfig deleteempty 30     # Change delete delay
   /vcconfig inactivity 120     # Enable 2-hour inactivity timeout
   ```

## Common Settings

### Standard Configuration
```
/vcconfig cooldown 30          # 30 second cooldown
/vcconfig deleteempty 60       # Delete after 1 minute empty
/vcconfig maxvcs 10            # Max 10 channels
/vcconfig inactivity 0         # Inactivity disabled
```

### Aggressive (Cleanup-focused)
```
/vcconfig cooldown 60          # 1 minute between creations
/vcconfig deleteempty 30       # Delete after 30 seconds empty
/vcconfig maxvcs 5             # Max 5 channels
/vcconfig inactivity 30        # Delete after 30 min inactivity
```

### Relaxed (User-friendly)
```
/vcconfig cooldown 10          # 10 second cooldown
/vcconfig deleteempty 120      # Delete after 2 minutes empty
/vcconfig maxvcs 20            # Max 20 channels
/vcconfig inactivity 0         # Inactivity disabled
```

## Troubleshooting

### "Module not configured"
- Run `/vcconfig view`
- Ensure Creator Channel and Category are set
- Run `/vcconfig enable`

### "Channel creation failed"
- Verify bot has permission to create channels in category
- Check category still exists
- Verify bot can move users between channels

### "Empty channels not deleting"
- Check `deleteAfterEmpty` setting with `/vcconfig view`
- Channels only delete when completely empty
- Wait the configured time (default 60s)

### "Users can join locked channels"
- User might be in the permitted list
- Run `/vcpermit deny <user>` to explicitly deny
- Check if user has channel manage permissions (bypass)

### "Cooldown isn't working"
- Each user has separate cooldown
- Check with `/vcconfig view`
- Cooldown resets after configured seconds

## Customization

### Change Channel Name Template
The default template is `"{user}'s Channel"`

To change, modify in `helpers.ts`:
```typescript
nameTemplate: "🎤 {user}'s Gaming Room"
```

Then reload the module.

### Change Default Bitrate
Modify in `helpers.ts`:
```typescript
bitrate: 96000  // Higher quality (64000 default)
```

### Change Default User Limit
Modify in `helpers.ts`:
```typescript
defaultUserLimit: 5  // Start at 5 users (0 = unlimited)
```

## Advanced Features

### Inactivity Timeouts
Automatically delete channels with no voice activity:
```
/vcconfig inactivity 120  # Delete after 2 hours of silence
```

### User Banning
Prevent specific users from creating temp VCs:
```
/vcban <user> Spam
/vcban <user> Abuse
```

### Permission Management
Lock and control who joins:
```
/vclock lock                   # Lock your channel
/vcpermit permit <friend>      # Allow friend in
/vcpermit deny <rival>         # Block rival
```

## Monitoring

Check module health:
```
/vcconfig view
```

Monitor with logging (in bot logs):
- `[TempVoice] Loaded X commands`
- `[TempVoice] Module initialized successfully`
- `[TempVoice] Created temp VC: [channel-id]`
- `[TempVoice] Deleted temp VC: [channel-id]`

## Support

For issues:
1. Check the full [README.md](README.md)
2. Review [STRUCTURE.md](STRUCTURE.md) for architecture
3. Check bot logs for `[TempVoice]` entries
4. Verify permissions (Manage Channels for staff commands)

## File Locations

```
TempVoice/
├── core/           ← User commands
├── staff/          ← Admin commands  
├── helpers.ts      ← Core logic (customize here)
├── events.ts       ← Voice event handling
├── cleanup.ts      ← Auto-cleanup
├── index.ts        ← Module loader
└── README.md       ← Full documentation
```

## Next Steps

- Customize settings for your server
- Test with a small group
- Ban problematic users as needed
- Adjust timers based on usage patterns
- Monitor logs for issues
