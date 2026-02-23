# Custom Commands Module

A comprehensive custom commands system for Discord bots with advanced variable parsing, configurable options, and staff-only management.

## Features

- **Staff Only Creation** - Uses permission system (ManageGuild) to restrict who can create commands
- **Rich Variable System** - 40+ variables with user, server, channel, and cross-module data
- **Advanced Processing** - Supports conditionals, math expressions, and random selection
- **Flexible Configuration** - Per-command and per-guild settings
- **Cooldown System** - Per-user cooldowns with database tracking
- **Multiple Response Types** - Text, embeds, DMs, ephemeral messages
- **Aliases Support** - Multiple names for the same command
- **Usage Tracking** - Track how many times each command is used
- **Channel Restrictions** - Limit commands to specific channels
- **Role Requirements** - Set required roles per command

## Directory Structure

```
CustomCommands/
├── staff/
│   ├── create.ts        # /ccreate - Create custom command
│   ├── edit.ts          # /cedit - Edit custom command
│   ├── delete.ts        # /cdelete - Delete custom command
│   ├── list.ts          # /clist - List all commands
│   ├── variables.ts     # /cvariables - Show available variables
│   └── config.ts        # /cconfig - Module configuration
├── core/
│   └── trigger.ts       # Handles command invocation
├── parser.ts            # Variable parsing engine
├── helpers.ts           # Database operations
├── events.ts            # Message event handling
└── index.ts             # Module initialization
```

## Commands

### `/ccreate`
Create a new custom command with options.

**Options:**
- `name` (required) - Command name
- `response` (required) - Response text
- `embed` (optional) - Send as embed
- `cooldown` (optional) - Cooldown in seconds
- `required_role` (optional) - Required role
- `dm` (optional) - Send as DM
- `ephemeral` (optional) - Send ephemeral reply
- `delete_invocation` (optional) - Delete trigger message
- `reaction` (optional) - React with emoji

### `/cedit`
Edit an existing custom command.

**Options:** Same as create (all optional)

### `/cdelete`
Delete a custom command with confirmation.

**Options:**
- `name` (required) - Command name to delete

### `/clist`
List all custom commands with pagination.

**Options:**
- `search` (optional) - Search for specific command

### `/cvariables`
Show all available variables with descriptions.

**Options:**
- `category` (optional) - View specific category

### `/cconfig`
Configure module settings per guild.

**Subcommands:**
- `view` - View current configuration
- `set` - Update settings (enabled, prefix, max_commands, allow_slash)

## Variable System

### User Variables
- `{user}` - Username
- `{user.mention}` - Mention user
- `{user.id}` - User ID
- `{user.name}` - Username
- `{user.tag}` - Full tag
- `{user.avatar}` - Avatar URL
- `{user.joindate}` - Join date
- `{user.createdate}` - Account creation date

### Server Variables
- `{server}` - Server name
- `{server.name}` - Server name
- `{server.id}` - Server ID
- `{server.membercount}` - Member count
- `{server.icon}` - Icon URL
- `{server.boosts}` - Number of boosts

### Channel Variables
- `{channel}` - Channel name
- `{channel.name}` - Channel name
- `{channel.id}` - Channel ID
- `{channel.topic}` - Channel topic
- `{channel.mention}` - Mention channel

### Arguments
- `{args}` - All arguments joined
- `{args.1}` - First argument
- `{args.2}` - Second argument
- `{args.N}` - Nth argument

### Random
- `{random.1-100}` - Random number in range
- `{random.member}` - Random guild member
- `{random.channel}` - Random channel
- `{random.role}` - Random role

### Time & Date
- `{time}` - Current local time
- `{time.utc}` - Current UTC time
- `{date}` - Current local date
- `{date.utc}` - Current UTC date

### Cross-Module Data
- `{level}` - User level
- `{xp}` - User XP
- `{coins}` - User coins
- `{reputation}` - User reputation
- `{messages}` - Message count

### Advanced Features
- `{choose:opt1|opt2|opt3}` - Random selection
- `{if:condition|then|else}` - Conditional
- `{math:2+2*3}` - Math expression

## Conditional Syntax

The `{if:condition|then|else}` syntax supports comparisons:

```
{if:user.id==123456789|Admin detected!|Not admin}
{if:server.membercount>=100|You have 100+ members!|Grow your server}
{if:args.1==hello|Hello back!|Hi there}
```

**Operators:** `==`, `!=`, `>`, `<`, `>=`, `<=`

## Math Expressions

```
{math:2+2}           → 4
{math:10*5-3}        → 47
{math:100/2}         → 50
{math:(10+5)*2}      → 30
```

## Examples

### Simple Response
**Name:** `hello`
**Response:** `Hello {user.mention}! Welcome to {server.name}.`
**Trigger:** `!hello` → "Hello @User! Welcome to My Server."

### With Embed
**Name:** `info`
**Response:** `Server has {server.membercount} members and {server.boosts} boosts`
**Embed:** Yes
**Response Type:** Shows as nicely formatted embed

### With Conditional
**Name:** `admin`
**Response:** `{if:user.id==YOUR_ID|You are the admin!|You are not the admin}`
**Trigger:** `!admin` → Shows appropriate message

### With Random
**Name:** `pick`
**Response:** `I pick {random.member}!`
**Trigger:** `!pick` → "I pick @RandomUser!"

### With Cooldown
**Name:** `daily`
**Response:** `Here's your daily reward: {random.1-100} coins!`
**Cooldown:** 86400 (24 hours)
**Trigger:** Can only use once per day

## Database Schema

### custom_commands
- `id` (UUID) - Primary key
- `guild_id` (VARCHAR) - Guild ID
- `name` (VARCHAR) - Command name
- `aliases` (JSONB) - Alternative names
- `response` (TEXT) - Response text
- `embed_response` (BOOLEAN) - Use embed format
- `required_role_id` (VARCHAR) - Required role
- `cooldown` (INTEGER) - Cooldown in seconds
- `use_count` (INTEGER) - Times used
- `created_by` (VARCHAR) - Creator user ID
- `created_at` (TIMESTAMP) - Creation time
- `dm` (BOOLEAN) - Send as DM
- `ephemeral` (BOOLEAN) - Ephemeral message
- `delete_invocation` (BOOLEAN) - Delete trigger
- `add_reaction` (VARCHAR) - Reaction emoji
- `allowed_channels` (JSONB) - Channel whitelist

### custom_commands_config
- `guild_id` (VARCHAR) - Primary key
- `enabled` (BOOLEAN) - Module enabled
- `prefix` (VARCHAR) - Command prefix
- `max_commands` (INTEGER) - Command limit
- `allow_slash` (BOOLEAN) - Slash command support

### command_cooldowns
- `guild_id` (VARCHAR) - Guild ID
- `command_id` (UUID) - Command ID
- `user_id` (VARCHAR) - User ID
- `cooldown_expires_at` (TIMESTAMP) - Expiration time

## Configuration

### Guild Configuration
Each guild can have custom settings:

```
/cconfig set enabled:true prefix:! max_commands:50 allow_slash:true
```

**Default Settings:**
- Enabled: true
- Prefix: !
- Max Commands: 50
- Allow Slash: true

## Permissions

All staff commands require:
- `ManageGuild` permission in the guild
- Proper permission path in bot's permission system

## Usage Tracking

Each command tracks:
- Total uses
- Creation timestamp
- Creator ID
- Last response

## Cooldown System

Cooldowns are:
- Per-user, per-command
- Configurable in seconds
- Stored in database with expiration
- Automatically cleaned up

## Module Initialization

```typescript
import CustomCommandsModule from './Modules/CustomCommands';

const customCommandsModule = new CustomCommandsModule(client, pool);
await customCommandsModule.initialize();
```

## Related Modules

The Custom Commands module can integrate with:
- Levels Module (for `{level}`, `{xp}`)
- Economy Module (for `{coins}`)
- Reputation Module (for `{reputation}`)
- Stats Module (for `{messages}`)

## Performance Notes

- Variable parsing uses regex for efficiency
- Database queries are indexed for fast lookups
- Cooldowns are cached in memory and periodically cleaned
- Math expressions use safe evaluation
- Conditional evaluation supports nesting

## Security

- All math expressions are sandboxed
- Database inputs are parameterized
- Permission checks are enforced
- Command names are validated and normalized
- No arbitrary code execution possible

## Troubleshooting

### Command Not Triggering
1. Check guild prefix with `/cconfig view`
2. Verify command name is correct
3. Check if module is enabled
4. Look for console errors

### Variables Not Parsing
1. Check variable syntax with `/cvariables`
2. Verify spacing (no spaces inside `{}`)
3. Check for typos in variable names
4. Some variables require specific contexts

### Cooldown Not Working
1. Verify cooldown time is > 0
2. Check database connectivity
3. Ensure command has been used at least once

## Performance Optimization

- Commands are cached per guild
- Database queries use prepared statements
- Indexes on frequently queried columns
- Efficient pagination for large command lists
