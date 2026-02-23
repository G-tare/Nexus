# Confessions Module

Anonymous confession system with full anonymity mode, moderation queue, and user banning capabilities.

## Features

- **Anonymous Confessions**: Users can submit confessions anonymously
- **Full Anonymity Mode**: When enabled, even server owners cannot see who confessed
- **Moderation Queue**: Optional approval system before confessions are posted
- **Confession Banning**: Ban users by confession ID without revealing their identity
- **Cooldown System**: Prevent spam with per-user cooldowns
- **Blacklist**: Auto-reject confessions containing prohibited words
- **Image Support**: Optional image attachments in confessions
- **Numbered Confessions**: Each confession gets a unique ID (#1, #2, #3...)
- **Reveal Feature**: Server owners can reveal authors (if not in full anonymity mode)

## Directory Structure

```
Modules/Confessions/
├── helpers.ts              # Core utilities and config management
├── events.ts               # Button interaction handlers
├── index.ts                # Module export and registration
├── core/
│   └── confess.ts          # /confess command
├── manage/
│   ├── approve.ts          # /confession-approve command
│   ├── deny.ts             # /confession-deny command
│   └── ban.ts              # /confession-ban command (subcommands)
├── staff/
│   ├── config.ts           # /confession-config command (subcommands)
│   └── reveal.ts           # /confession-reveal command
└── README.md               # This file
```

## Commands

### User Commands

#### `/confess`
Submit an anonymous confession.

**Options:**
- `message` (String, required): Confession text (max 2000 chars)
- `image` (Attachment, optional): Image to attach

**Behavior:**
- Checks if confessions are enabled
- Verifies user is not banned
- Checks cooldown
- Validates against blacklist
- If moderation is enabled: moves to approval queue
- If moderation disabled: posts immediately
- Applies cooldown

---

### Staff Commands

#### `/confession-approve`
Approve a pending confession and post it.

**Options:**
- `id` (Integer, required): Confession ID

**Permissions:** ManageMessages

---

#### `/confession-deny`
Deny and remove a pending confession.

**Options:**
- `id` (Integer, required): Confession ID
- `reason` (String, optional): Reason for denial

**Permissions:** ManageMessages

---

#### `/confession-ban`
Ban or unban users by confession ID.

**Subcommands:**

**`ban`**
- Options: `confession-id` (Integer) - Bans the author without revealing identity
- Permissions: ManageGuild

**`unban`**
- Options: `confession-id` (Integer) - Unbans by the confession they were banned from
- Permissions: ManageGuild

**`list`**
- Lists all banned users (shows hash prefix and count only)
- Permissions: ManageGuild

---

### Owner Commands

#### `/confession-config`
Configure confession settings.

**Permissions:** ManageGuild

**Subcommands:**

**`view`**
- Shows all current settings

**`channel`**
- Options: `channel` (TextChannel) - Sets the confession posting channel

**`moderation`**
- Options:
  - `enabled` (Boolean) - Enable/disable moderation queue
  - `channel` (TextChannel, optional) - Moderation queue channel
- Note: Channel is required when enabling moderation

**`anonymity`**
- Options: `enabled` (Boolean) - Enable/disable full anonymity mode
- Warning message shown when enabling

**`cooldown`**
- Options: `seconds` (Integer, 0-3600) - Sets per-user cooldown duration

**`blacklist-add`**
- Options: `word` (String) - Add word to blacklist

**`blacklist-remove`**
- Options: `word` (String) - Remove word from blacklist

**`blacklist-list`**
- Shows all blacklisted words

**`images`**
- Options: `enabled` (Boolean) - Allow/disallow image attachments

**`color`**
- Options: `color` (String) - Hex color code (e.g., #9B59B6)

---

#### `/confession-reveal`
Reveal the author of a confession (Owner Only).

**Options:**
- `id` (Integer, required): Confession ID

**Behavior:**
- Only works if server owner runs it
- Shows error if full anonymity is enabled
- Shows user mention and ID

**Permission Path:** `confessions.owner.reveal`

---

## Configuration

Default configuration:
```typescript
{
  enabled: false,
  channelId: undefined,
  moderationEnabled: false,
  moderationChannelId: undefined,
  fullAnonymity: false,
  cooldownSeconds: 300,
  blacklistedWords: [],
  confessionCounter: 0,
  allowImages: false,
  embedColor: '#9B59B6',
  bannedHashes: [],
}
```

Configuration is stored per guild in Redis with 30-day expiration.

## Anonymity System

### Full Anonymity OFF (Default)
- Confessions are stored with user ID
- Server owner can use `/confession-reveal` to see the author
- User hashes stored for banning purposes
- Identity can be revealed to server owner only

### Full Anonymity ON
- User IDs are NOT stored
- Only user hash is stored (SHA256 of `userId:guildId:confessions_salt`)
- `/confession-reveal` is disabled
- Users can still be banned by confession ID (hash tracked)
- Even the server owner cannot see who confessed

## User Banning

When a user is banned:
1. Their user hash is added to `bannedHashes` list
2. No plaintext user ID is stored in the config
3. Users cannot confess while banned
4. Admins cannot tell who was banned from the hash alone (privacy protected)

To unban: Reference the confession ID they were banned from, and the hash is removed.

## Storage

All data is stored in Redis:
- **Config**: `confessions_config:{guildId}` (JSON)
- **Confessions**: `confession:{guildId}:{number}` (Hash)
- **Pending**: `confession_pending:{guildId}:{number}` (Hash)
- **Cooldown**: `confess:cd:{guildId}:{userId}` (TTL key)

Confessions are kept for 365 days. Pending confessions are kept for 7 days.

## Events

### Button Handlers
- `confession_approve_{id}`: Approves pending confession (ManageMessages required)
- `confession_deny_{id}`: Denies pending confession (ManageMessages required)

These are displayed on the moderation queue embeds.

## Premium Features

- **`confessions.basic`**: Core confession submission feature

## Module Metadata

- **Name**: `confessions`
- **Display Name**: `Confessions`
- **Category**: `engagement`

## Implementation Notes

- All staff commands require `ManageGuild` permission (except reveal which requires owner)
- All management commands require `ManageMessages` permission
- Ephemeral replies are used for all staff/management feedback
- Images are stored as URLs only (not downloaded)
- Cooldown is applied AFTER successful submission
- Blacklist checks are case-insensitive
- Color validation uses regex for hex format
