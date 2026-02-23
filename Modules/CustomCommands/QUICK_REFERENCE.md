# Custom Commands - Quick Reference Guide

## Commands Overview

| Command | Purpose | Permission |
|---------|---------|-----------|
| `/ccreate` | Create custom command | ManageGuild |
| `/cedit` | Edit custom command | ManageGuild |
| `/cdelete` | Delete custom command | ManageGuild |
| `/clist` | List all commands | ManageGuild |
| `/cvariables` | Show available variables | ManageGuild |
| `/cconfig` | Configure module settings | ManageGuild |

## Variables Cheatsheet

### User
```
{user}           Username
{user.mention}   @user
{user.id}        User ID
{user.name}      Username
{user.tag}       user#0000
{user.avatar}    Avatar URL
{user.joindate}  Join date
{user.createdate}Account creation date
```

### Server
```
{server}         Server name
{server.id}      Server ID
{server.membercount} Member count
{server.icon}    Icon URL
{server.boosts}  Number of boosts
```

### Channel
```
{channel}        Channel name
{channel.id}     Channel ID
{channel.topic}  Topic text
{channel.mention}#channel
```

### Arguments
```
{args}      All arguments
{args.1}    First argument
{args.2}    Second argument
{args.N}    Nth argument
```

### Random
```
{random.1-100}   Random 1-100
{random.member}  Random member
{random.channel} Random channel
{random.role}    Random role
```

### Time & Date
```
{time}      Local time
{time.utc}  UTC time
{date}      Local date
{date.utc}  UTC date
```

### Cross-Module
```
{level}    User level
{xp}       User XP
{coins}    User coins
{reputation} User reputation
{messages} Message count
```

### Advanced
```
{choose:a|b|c}          Random selection
{if:condition|yes|no}   Conditional
{math:2+2}              Math expression
```

## Conditional Operators

| Operator | Meaning |
|----------|---------|
| `==` | Equals |
| `!=` | Not equals |
| `>` | Greater than |
| `<` | Less than |
| `>=` | Greater or equal |
| `<=` | Less or equal |

**Examples:**
```
{if:user.id==12345|Admin|User}
{if:server.membercount>=100|Large|Small}
{if:args.1==hello|Greeting detected|No greeting}
```

## Command Options

| Option | Purpose | Type | Example |
|--------|---------|------|---------|
| `name` | Command name | text | `hello` |
| `response` | Response text | text | `Hello there!` |
| `embed` | Send as embed | boolean | `true` |
| `cooldown` | Cooldown seconds | number | `3600` |
| `required_role` | Required role | role | `Admin` |
| `dm` | Send as DM | boolean | `true` |
| `ephemeral` | Hide from others | boolean | `true` |
| `delete_invocation` | Delete trigger | boolean | `true` |
| `reaction` | React emoji | emoji | `✅` |

## Common Cooldown Values

| Duration | Seconds | Usage |
|----------|---------|-------|
| 1 minute | 60 | Quick commands |
| 5 minutes | 300 | Regular commands |
| 1 hour | 3600 | Hourly events |
| 12 hours | 43200 | Twice daily |
| 1 day | 86400 | Daily rewards |
| 1 week | 604800 | Weekly events |

## Quick Examples

### Echo
```
/ccreate name:echo response:{args}
!echo hello world → hello world
```

### Welcome
```
/ccreate name:welcome response:Welcome {user.mention} to {server.name}!
!welcome → Welcome @User to My Server!
```

### Help
```
/ccreate name:help response:Need help? Ask in {channel.mention}
!help → Need help? Ask in #support
```

### Daily
```
/ccreate name:daily response:You got {random.1-100} coins! cooldown:86400
!daily → You got 47 coins! (then 24h cooldown)
```

### Dice
```
/ccreate name:roll response:You rolled a {random.1-6}!
!roll → You rolled a 4!
```

### Random
```
/ccreate name:pick response:I pick {random.member}!
!pick → I pick @SomeUser!
```

### Info
```
/ccreate name:info response:Server: {server.name} ({server.membercount} members) embed:true
!info → (formatted embed with info)
```

### Admin Check
```
/ccreate name:whoami response:{if:user.id==YOUR_ID|You're the boss!|You're not the boss}
!whoami → You're not the boss
```

## Setup Guide

### 1. Enable Module
```
/cconfig set enabled:true
```

### 2. Set Prefix (Optional)
```
/cconfig set prefix:>
```

### 3. Create Commands
```
/ccreate name:hello response:Hello {user.mention}!
/ccreate name:rules response:1. Be nice 2. No spam embed:true
/ccreate name:daily response:Daily done! cooldown:86400
```

### 4. Verify
```
/clist
```

### 5. Test
```
!hello
!rules
!daily
```

## Editing Commands

```
/cedit name:hello response:Hi {user.mention}!
/cedit name:daily cooldown:43200
/cedit name:admin required_role:Admin
```

## Deleting Commands

```
/cdelete name:hello
```

## Listing Commands

```
/clist                    All commands
/clist search:daily       Search for "daily"
```

## Viewing Variables

```
/cvariables                          All categories
/cvariables category:User Variables  Specific category
```

## Viewing Configuration

```
/cconfig view
```

## Response Types

### Plain Text (Default)
```
response: Hello {user.mention}!
```

### Embed
```
embed: true
response: Server Stats
```

### Direct Message
```
dm: true
response: Secret message
```

### Ephemeral (Visible only to user)
```
ephemeral: true
response: Private info
```

### Delete Trigger
```
delete_invocation: true
response: Command executed
```

### Add Reaction
```
add_reaction: ✅
response: Done!
```

## Troubleshooting

### Command Not Working?
1. Check if enabled: `/cconfig view`
2. Check prefix: `/cconfig view`
3. Check cooldown: Use after cooldown expires
4. Check role requirement: Have required role

### Variable Not Showing?
1. Check spelling exactly
2. No spaces inside `{}`
3. Use `/cvariables` to verify
4. Check variable context (e.g., channel topic may be empty)

### Got Cooldown Message?
1. Wait for cooldown to expire
2. Check `/cconfig view` for remaining time
3. Use `/cedit` to change cooldown

## Performance Tips

1. Use short response text when possible
2. Avoid complex math in high-frequency commands
3. Set reasonable cooldowns to prevent abuse
4. Use embeds sparingly for better performance
5. Test variables before publishing

## Security Notes

- Only users with ManageGuild can create commands
- Permissions are enforced at execution
- No arbitrary code execution possible
- Database queries are safe from injection
- Math expressions are sandboxed

## Limits

- Command name: 100 characters max
- Response: 2000 characters (text), 4096 (embed)
- Aliases: Unlimited
- Commands per guild: 50 (configurable, max 500)
- Cooldown: 0-unlimited seconds
- Arguments: Unlimited
- Channels whitelist: Unlimited

## Keyboard Shortcuts

None - Use Discord slash commands (/)

## Tips & Tricks

1. **Use multiple variables**: `Welcome {user.mention} to {server.name}!`
2. **Stack conditionals**: `{if:user.id==X|Admin text|{if:role==Y|Mod text|User text}}`
3. **Math for calculations**: `{math:level*100}` for XP to next level
4. **Random selection**: `{choose:Good morning|Good afternoon|Good evening}`
5. **Hidden commands**: Use `ephemeral:true` for private info
6. **Delete messages**: Use `delete_invocation:true` to clean spam

## Get Help

- View all variables: `/cvariables`
- View config: `/cconfig view`
- List commands: `/clist`
- Create command: `/ccreate`
- Edit command: `/cedit`
- Delete command: `/cdelete`

