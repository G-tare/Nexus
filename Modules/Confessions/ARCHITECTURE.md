# Confessions Module - Architecture & Design

## System Overview

The Confessions module is a complete anonymous confession system with four key architectural layers:

```
┌─────────────────────────────────────────────────────┐
│                 DISCORD.JS LAYER                     │
│            (SlashCommands & Events)                  │
├─────────────────────────────────────────────────────┤
│                 COMMAND LAYER                        │
│  core/ | manage/ | staff/                            │
│  (6 command files)                                   │
├─────────────────────────────────────────────────────┤
│                  LOGIC LAYER                         │
│  helpers.ts (12 core functions)                      │
├─────────────────────────────────────────────────────┤
│                 STORAGE LAYER                        │
│  Redis (config, confessions, pending, cooldowns)    │
└─────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. User Anonymity

**Without Full Anonymity Mode (Default)**
```
User submits /confess
    ↓
userHash = SHA256(userId:guildId:salt)  [One-way]
    ↓
Both userHash AND userId stored
    ↓
Owner can run /confession-reveal to see userId
```

**With Full Anonymity Mode (Enabled)**
```
User submits /confess
    ↓
userHash = SHA256(userId:guildId:salt)  [One-way]
    ↓
ONLY userHash stored
userId is discarded
    ↓
Owner CANNOT reveal (command disabled)
Only way to track user: by hash (impossible to reverse)
```

### 2. User Banning

Uses user hash instead of ID:

```
Admin wants to ban author of confession #5
    ↓
/confession-ban ban confession-id:5
    ↓
Get confession #5 from Redis
Extract userHash
Add userHash to config.bannedHashes
    ↓
User tries to /confess
    ↓
Check isConfessionBanned(userId)
    ↓
Hash current userId
Compare hash to bannedHashes list
    ↓
If match: reject confession
```

**Privacy benefit**: Admin never learns who was banned. Only confession number is referenced.

### 3. Configuration System

Per-guild configuration stored in Redis:

```typescript
Key: confessions_config:{guildId}
TTL: 30 days
Type: JSON string
```

Configuration changes are immediate:
- No restart needed
- Affects all future confessions
- Previous confessions unaffected

### 4. Moderation Workflow

**Without Moderation Queue:**
```
User: /confess message:"..."
    ↓
Store confession
Post immediately
Reply: "Confession #X submitted"
```

**With Moderation Queue:**
```
User: /confess message:"..."
    ↓
Store as pending
Post embed in moderation channel with buttons
Reply: "Submitted for review"
    ↓
Moderator clicks "Approve" button
    ↓
Move from pending → approved
Post to main channel
Update moderation message
```

## Data Model

### Confession Object
```typescript
{
  userHash: string;           // SHA256(userId:guildId:salt)
  userId?: string;            // Optional, only if fullAnonymity OFF
  content: string;            // Max 2000 chars
  timestamp: number;          // Unix timestamp
  imageUrl?: string;          // Discord CDN URL
}
```

### Stored in Redis Hashes
```
confession:{guildId}:{number}
├── userHash: "abc123..."
├── userId: "987654321"        (conditional)
├── content: "My confession..."
├── timestamp: "1708694400"
└── imageUrl: "https://..."
```

### Config Object
```typescript
{
  enabled: boolean;
  channelId?: string;           // Where confessions post
  moderationEnabled: boolean;
  moderationChannelId?: string; // Where to review
  fullAnonymity: boolean;       // Privacy level
  cooldownSeconds: number;      // Per-user ratelimit
  blacklistedWords: string[];   // Auto-reject words
  confessionCounter: number;    // Next ID
  allowImages: boolean;         // Image support
  embedColor: string;           // Hex color
  bannedHashes: string[];       // Banned user hashes
}
```

## Function Map

### Helpers (helpers.ts)

**Configuration**
- `getConfessionConfig(guildId)` - Get config with defaults
- `setConfessionConfig(guildId, config)` - Save config to Redis

**Confession Counter**
- `getNextConfessionNumber(guildId)` - Increment & return number

**User Identification**
- `hashUserId(userId, guildId)` - Create one-way hash
- `isConfessionBanned(guildId, userId)` - Check if user banned

**User Management**
- `banByConfessionId(guildId, id)` - Ban by confession ID
- `unbanByConfessionId(guildId, id)` - Unban by confession ID

**Content Validation**
- `checkBlacklist(text, blacklist)` - Detect blacklisted words

**Storage Operations**
- `storeConfession()` - Save approved confession
- `getConfessionData()` - Retrieve confession
- `storePendingConfession()` - Save for moderation
- `getPendingConfessionData()` - Get pending confession
- `removePendingConfession()` - Delete from queue

**UI Builders**
- `buildConfessionEmbed()` - Create posting embed
- `buildModerationEmbed()` - Create moderation embed

**Rate Limiting**
- `checkCooldown()` - Get remaining cooldown
- `setCooldown()` - Apply cooldown

### Commands

**Core**
- `confess.ts` - /confess command

**Management**
- `approve.ts` - /confession-approve
- `deny.ts` - /confession-deny
- `ban.ts` - /confession-ban

**Staff**
- `config.ts` - /confession-config
- `reveal.ts` - /confession-reveal

### Events

- `events.ts` - Button handler for approve/deny

## Request Flow Diagrams

### Confession Submission Flow
```
/confess message:"text" image:null
    ↓
Check enabled? ✓
Check channel set? ✓
Check cooldown (key: confess:cd:{guildId}:{userId})? ✓
Check banned (hash in bannedHashes)? ✓
Check blacklist? ✓
Check image allowed? ✓
    ↓
Get next number (counter++)
Create hash: SHA256(userId:guildId:salt)
    ↓
moderationEnabled?
├─ YES:
│   storePendingConfession()
│   Send embed to mod channel with buttons
│   Reply: "Submitted for review"
└─ NO:
    storeConfession()
    Send embed to main channel
    Reply: "Confession #X submitted"
    ↓
setCooldown(cooldownSeconds)
    ↓
Return success
```

### Approval Flow
```
Moderator clicks "Approve" button
    ↓
Check permission (ManageMessages)? ✓
    ↓
getPendingConfessionData(number)
    ↓
storeConfession() [move to approved]
    ↓
Send embed to main channel
    ↓
removePendingConfession()
    ↓
Update moderation message with ✅
```

### Reveal Flow
```
Owner runs /confession-reveal id:5
    ↓
Check owner? ✓
    ↓
Config: fullAnonymity?
├─ YES: Reply error "Full anonymity enabled"
└─ NO:
    getConfessionData(5)
    Extract userId
    Fetch user object
    Reply: "User: @name (ID)"
```

### Ban Flow (Two Methods)

**By Confession ID:**
```
/confession-ban ban confession-id:5
    ↓
getConfessionData(5)
Extract userHash
Add to config.bannedHashes
Save config
    ↓
Future /confess attempts from that user:
hashUserId() → Check bannedHashes → Reject
```

**By Configuration:**
```
/confession-config
    ↓
User runs any config subcommand
    ↓
Load current config
Modify requested field
Save to Redis
Cache expires in 30 days
```

## Security Architecture

### 1. Hashing Strategy

```
Input: userId (snowflake) + guildId (snowflake) + static salt
↓
SHA256 hash algorithm
↓
Output: 64-char hex string (one-way, deterministic)

Properties:
- Same user in same guild = same hash
- Different user = different hash
- Same user in different guild = different hash
- Cannot reverse to get userId
```

### 2. Privacy Isolation

Without full anonymity:
```
Author identity: Stored with confession
Reveal capability: Server owner only
Use case: General communities
```

With full anonymity:
```
Author identity: Never stored
Reveal capability: Disabled entirely
Use case: Sensitive/therapeutic communities
```

### 3. Ban System

Instead of storing banned userIds:
```
Config: bannedHashes = ["abc123...", "def456..."]

Rationale:
- Config visible to admins (contains hashes)
- Hash cannot be reversed to user
- Even admins don't know who is banned
- Perfect for full anonymity servers
```

### 4. Rate Limiting

```
Key: confess:cd:{guildId}:{userId}
TTL: Set to cooldownSeconds
Value: "1" (placeholder)

Check: If key exists, user is on cooldown
Apply: After successful submission
```

### 5. Content Filtering

```
Blacklist: Array of strings
Check: Case-insensitive substring match
Apply: Before any storage
Reject: Return error, don't store, no cooldown wasted
```

## Data Retention

| Data Type | Storage | TTL | Cleanup |
|-----------|---------|-----|---------|
| Config | Redis | 30 days | Auto-expire |
| Approved Confession | Redis Hash | 365 days | Auto-expire |
| Pending Confession | Redis Hash | 7 days | Auto-expire |
| Cooldown | Redis Key | Variable | Auto-expire |
| User Hash (banned) | Config | ∞ | Manual `/ban unban` |

## Error Handling Strategy

All commands follow pattern:
```typescript
try {
  // Validate prerequisites
  if (!config.enabled) return error;
  if (!config.channelId) return error;

  // Fetch data
  const data = await getData();
  if (!data) return error;

  // Execute operation
  await executeOperation();

  // Confirm success
  return success;
} catch (error) {
  console.error('Error in confession:', error);
  return generic_error;
}
```

## Performance Optimizations

### 1. Redis Caching
- Config cached 30 days
- Reduces database queries
- Immediate cache invalidation on updates

### 2. Stateless Design
- No session state stored
- Each request is independent
- Easy horizontal scaling

### 3. Efficient Hashing
- SHA256 is fast (microseconds)
- Deterministic (same input = same output)
- No database lookup needed for bans

### 4. Lazy Loading
- Fetch only needed data
- Don't load all confessions for one operation
- Minimal Redis memory footprint

## Testing Strategy

### Unit Tests (Per Command)
- Validation passes/fails
- Permissions checked
- Data stored correctly

### Integration Tests (Cross-Command)
- Confession → Ban → Cannot confess
- Moderation queue: submit → approve → posted
- Config change → affects next confession

### Scenario Tests
- Full anonymity workflow
- Multi-guild isolation
- Concurrent confessions

## Extension Points

### 1. Custom Validation
```typescript
// In confess.ts, before blacklist check
if (customValidation(message)) {
  return error;
}
```

### 2. Custom Storage
```typescript
// Replace Redis with database
const db = new Database();
await db.saveConfession(guildId, number, data);
```

### 3. Custom Embeds
```typescript
// Modify buildConfessionEmbed()
embed.setAuthor({ name: "📝 Confession" });
embed.setThumbnail(anonymousAvatarUrl);
```

### 4. Additional Commands
```typescript
// Add new subcommand to config
.addSubcommand(sub =>
  sub.setName('export')
    .setDescription('Export confessions to CSV')
)
```

### 5. Event Listeners
```typescript
// Add custom logging
moduleConfig.on('confession.submitted', (data) => {
  logger.info(`Confession #${data.number} in ${data.guildId}`);
});
```

## Scalability Considerations

### Small Server (1-100 users)
- Redis in-memory sufficient
- Single bot instance
- All features enabled

### Medium Server (100-10k users)
- Redis persistence (RDB/AOF)
- Consider Redis Cluster
- Monitor memory usage

### Large Network (10k+ users)
- Redis Cluster required
- Multiple bot shards
- Archive old confessions
- Separate moderation queue Redis instance

## Deployment Checklist

- [ ] Redis running and accessible
- [ ] Environment variables configured
- [ ] Commands registered with Discord API
- [ ] Event listeners attached
- [ ] Module exported in index.ts
- [ ] Permissions set correctly
- [ ] Test server ready
- [ ] Commands visible in bot menu
- [ ] Slash autocomplete working
- [ ] Premium features configured

## Compliance & Privacy

### GDPR Considerations
- User IDs only stored if fullAnonymity OFF
- Can delete confessions per GDPR right to be forgotten
- Hashes cannot identify individuals
- Data retention documented (365 days)

### Data Security
- No plaintext storage
- One-way hashing for user identification
- Redis should be secured (password, firewall)
- Ephemeral replies for sensitive info

### Access Control
- Owner-only reveal feature
- Role-based permission checks
- ManageGuild/ManageMessages enforcement
- No command bypass possibilities
