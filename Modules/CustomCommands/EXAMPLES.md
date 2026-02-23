# Custom Commands Module - Usage Examples

## Creating Your First Command

### Basic Hello Command
```
/ccreate
  name: hello
  response: Hello {user.mention}! 👋
```

**Trigger:** `!hello` → "Hello @User! 👋"

---

## Variable Usage Examples

### Welcome Message with Server Info
```
/ccreate
  name: welcome
  response: Welcome {user.mention}! You've joined {server.name} which has {server.membercount} members!
  embed: true
```

**Trigger:** `!welcome` → Shows as formatted embed with welcome message

---

### User Statistics
```
/ccreate
  name: stats
  response: {user.mention} - Level: {level} | XP: {xp} | Coins: {coins} | Messages: {messages}
```

**Trigger:** `!stats` → Shows user's cross-module statistics

---

### Current Time Display
```
/ccreate
  name: time
  response: Current time: {time} | Date: {date}
```

**Trigger:** `!time` → "Current time: 2:45:30 PM | Date: 2/22/2026"

---

### Random Member Mention
```
/ccreate
  name: pick
  response: The chosen one is... {random.member}! 🎯
```

**Trigger:** `!pick` → "The chosen one is... @RandomUser! 🎯"

---

## Advanced Features

### Conditional Responses
```
/ccreate
  name: admin
  response: {if:user.id==123456789|Welcome back, boss!|You are not the admin}
```

**Trigger:** `!admin` → Shows different message based on user ID

---

### Age-Based Welcome
```
/ccreate
  name: welcome
  response: {if:server.membercount>=1000|Welcome to our large community!|Welcome to our small but growing server!}
```

---

### Math-Based Reward
```
/ccreate
  name: roll
  response: You rolled a {math:random.1-20}!
```

Note: For actual random, use `{random.1-20}` instead

---

### Interactive Choice
```
/ccreate
  name: choose
  response: I choose: {choose:Option A|Option B|Option C}
```

**Trigger:** `!choose` → Randomly selects one of the options

---

## Argument-Based Commands

### Echo Command
```
/ccreate
  name: echo
  response: {args}
```

**Trigger:** `!echo hello world` → "hello world"

---

### Greeting with Name
```
/ccreate
  name: greet
  response: Hello {args.1}! Nice to meet you!
```

**Trigger:** `!greet John` → "Hello John! Nice to meet you!"

---

### Message About Channel
```
/ccreate
  name: channel
  response: You mentioned {args.1} in {channel.mention}. Topic: {channel.topic}
```

**Trigger:** `!channel general` → Provides info about the mentioned channel

---

## Configuration Examples

### Set Custom Prefix
```
/cconfig
  set
  prefix: >
```

**Now use:** `>hello` instead of `!hello`

---

### Limit Commands
```
/cconfig
  set
  max_commands: 100
```

---

### Disable Custom Commands
```
/cconfig
  set
  enabled: false
```

---

## Permission-Based Commands

### VIP-Only Command
```
/ccreate
  name: vip
  response: Welcome to the VIP section, {user.mention}! Exclusive content here.
  required_role: VIP Member
```

Only users with "VIP Member" role can use this command.

---

### Moderator Command
```
/ccreate
  name: modinfo
  response: Moderator {user.mention} checking {channel.mention}
  required_role: Moderator
```

---

## Cooldown Examples

### Daily Login Reward
```
/ccreate
  name: daily
  response: Daily reward claimed! Here are your coins: {random.1-100}
  cooldown: 86400
```

24-hour cooldown (86400 seconds)

---

### Hourly Check-In
```
/ccreate
  name: checkin
  response: Thanks for checking in, {user.mention}!
  cooldown: 3600
```

1-hour cooldown

---

### Per-Minute Command
```
/ccreate
  name: test
  response: Testing... {time}
  cooldown: 60
```

---

## Response Style Examples

### Ephemeral (Private) Response
```
/ccreate
  name: secret
  response: This is only visible to you!
  ephemeral: true
```

Only the command user sees the response.

---

### Direct Message
```
/ccreate
  name: dm
  response: Sending you a private message!
  dm: true
```

Response is sent as a DM to the user.

---

### Delete Command Message
```
/ccreate
  name: clean
  response: ✓ Command executed
  delete_invocation: true
```

The `!clean` message is deleted after execution.

---

### Add Reaction
```
/ccreate
  name: react
  response: Reacting to your message...
  add_reaction: ✅
```

The bot reacts to the command with a checkmark emoji.

---

### Formatted Embed
```
/ccreate
  name: info
  response: This is embedded information about {server.name}
  embed: true
```

Response is formatted as a nicely styled embed.

---

## Complex Examples

### Admin Panel Info
```
/ccreate
  name: admin
  response: {if:user.id==123456789|**ADMIN PANEL**
Guild: {server.name} ({server.membercount} members)
Members with role: {server.id}
Last checked: {time.utc}|You don't have access to this panel}
  embed: true
```

---

### Level-Up Announcement
```
/ccreate
  name: levelup
  response: 🎉 {user.mention} reached level {level}!
Level: {level}
XP: {xp}/{math:level*1000}
Rank: Top {math:messages/100}
```

---

### Server Status
```
/ccreate
  name: status
  response: **{server.name} Status**
👥 Members: {server.membercount}
⭐ Boosts: {server.boosts}
📅 Created: {date.utc}
```

---

### Interactive Help
```
/ccreate
  name: help
  response: {if:args.1==commands|Use `/clist` to see all commands|Use `!help commands` for command list}
  embed: true
```

**Trigger:** `!help` or `!help commands`

---

### Random Event
```
/ccreate
  name: event
  response: {choose:A wild {random.member} appeared!|{random.role} role is now active!|{random.channel} is under maintenance!}
```

Randomly selects from multiple event types.

---

## Practical Commands for Moderation

### Warn Counter
```
/ccreate
  name: warns
  response: Warnings for {args.1}: Check the database
```

---

### Rules
```
/ccreate
  name: rules
  response: **{server.name} Rules**
1. Be respectful
2. No spam
3. Follow Discord ToS
4. Have fun!
  embed: true
  dm: true
```

---

### Verification
```
/ccreate
  name: verify
  response: Welcome {user.mention}! You're now verified in {server.name}.
  add_reaction: ✅
```

---

## Fun Commands

### Roll Dice
```
/ccreate
  name: roll
  response: 🎲 You rolled: {random.1-6}!
```

---

### Flip Coin
```
/ccreate
  name: coin
  response: {choose:Heads! 🪙|Tails! 🪙}
```

---

### 8-Ball
```
/ccreate
  name: 8ball
  response: {choose:Yes|No|Maybe|Ask again later|Definitely|Absolutely not|Signs point to yes|Don't count on it}
```

---

### Hug Command
```
/ccreate
  name: hug
  response: {user.mention} hugs {random.member}! 🤗
```

---

## Best Practices

### 1. Use Clear Variable Names
```
GOOD:   {user.mention} joined {server.name}
BAD:    {user} joined {server}
```

### 2. Test Variables with /cvariables
Before creating a command with variables, check available options.

### 3. Set Appropriate Cooldowns
- High-frequency commands: 0s (no cooldown)
- Regular commands: 60s
- Daily rewards: 86400s (24 hours)
- Hourly events: 3600s (1 hour)

### 4. Use Embeds for Important Info
```
/ccreate name: status response: Important info embed: true
```

### 5. Add Reactions for Feedback
```
add_reaction: ✅
```

### 6. Delete Spam Commands
```
delete_invocation: true
```

### 7. Use DM for Private Data
```
dm: true
```

### 8. Document Complex Commands
Create a support channel explaining complex custom commands.

---

## Troubleshooting Examples

### Variable Not Working?
- Check spelling: `{user}` not `{User}`
- No spaces: `{user.mention}` not `{ user.mention }`
- Use `/cvariables` to see all options

### Command Not Responding?
- Check `/cconfig view` - is module enabled?
- Verify prefix is correct
- Check cooldown remaining
- Verify role requirement

### Response Looks Wrong?
- Check character limit (2000 for text, limits for embeds)
- Remove special formatting if on plain text
- Test without embeds first

---

## Command Ideas

### Server-Specific
- Welcome new members
- Daily tips
- Server rules
- Highlight updates
- Fun facts about the server

### Utility
- Ping checker
- Time display
- User info
- Server stats
- Channel topics

### Moderation
- Warning system
- Ban templates
- Mod resources
- Report templates

### Fun
- Jokes
- Quotes
- Random events
- Games
- Mini quests

---

## Export/Import (Future Feature)

Coming soon: Ability to backup and share custom commands.
