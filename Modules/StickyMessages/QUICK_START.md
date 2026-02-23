# Sticky Messages Module - Quick Start Guide

## What This Module Does

Keeps important messages "sticky" at the bottom of a Discord channel by automatically deleting and resending them based on either:
- A fixed interval (e.g., every 5 messages)
- Activity level (adapts to how busy the channel is)
- Hybrid (combination of both)

## Installation

1. Copy the entire `StickyMessages` folder to `/Modules/`
2. Create the database tables (see DATABASE section below)
3. Add to your bot's module loader

## Database Setup

Run these SQL commands:

```sql
-- Main table for sticky messages
CREATE TABLE IF NOT EXISTS stickyMessages (
  id VARCHAR(255) PRIMARY KEY,
  guildId VARCHAR(255) NOT NULL,
  channelId VARCHAR(255) NOT NULL,
  content TEXT,
  embedData JSONB,
  currentMessageId VARCHAR(255),
  interval INT DEFAULT 5,
  messagesSince INT DEFAULT 0,
  priority INT DEFAULT 0,
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Guild configuration table
CREATE TABLE IF NOT EXISTS stickyConfigs (
  guildId VARCHAR(255) PRIMARY KEY,
  config JSONB,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recommended indexes
CREATE INDEX idx_sticky_guild ON stickyMessages(guildId);
CREATE INDEX idx_sticky_channel ON stickyMessages(channelId);
CREATE INDEX idx_sticky_active ON stickyMessages(isActive);
```

## Core Commands

### Create a Sticky
```
/stick channel:#announcements content:"📢 Welcome to our server!" interval:8
```

### Remove a Sticky
```
/unstick channel:#announcements index:1
```

### Edit a Sticky
```
/stickyedit channel:#announcements index:1 content:"Updated message"
```

### View Config
```
/stickyconfig view
```

### Change Mode
```
/stickyconfig mode activity    # Use activity-based thresholds
/stickyconfig mode interval    # Use fixed interval
/stickyconfig mode hybrid      # Mix both approaches
```

## Operation Modes

| Mode | Behavior | Best For |
|------|----------|----------|
| **interval** | Re-stick after X messages | Predictable, consistent channels |
| **activity** | Adjust threshold based on traffic | Mixed activity channels |
| **hybrid** | Use interval minimum, scale up by activity | All-purpose, adaptive |

### Activity-Based Thresholds
- Low activity (<1 msg/min): 3 messages
- Medium activity (1-5 msg/min): 8 messages  
- High activity (>5 msg/min): 15 messages

## File Overview

| File | Purpose |
|------|---------|
| `tracker.ts` | Monitors message activity |
| `helpers.ts` | Database operations |
| `events.ts` | Handles Discord events |
| `index.ts` | Module initialization |
| `staff/stick.ts` | `/stick` command |
| `staff/unstick.ts` | `/unstick` command |
| `staff/stickyedit.ts` | `/stickyedit` command |
| `staff/config.ts` | `/stickyconfig` command |

## Configuration Options

Set per-guild with `/stickyconfig`:

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| enabled | true | boolean | Enable/disable module |
| mode | interval | interval/activity/hybrid | Re-stick strategy |
| maxStickiesPerChannel | 3 | 1-10 | Max stickies per channel |
| deleteBotMessage | true | boolean | Delete old before sending new |

## Key Features

✅ **Activity Detection**: Intelligent thresholds that adapt to channel traffic
✅ **Multiple Stickies**: Up to 3 per channel (configurable)
✅ **Priority System**: Control order with priority values
✅ **Edit Support**: Change content without recreating
✅ **Rate Limited**: 5-second minimum between re-sticks
✅ **Embed Support**: Full Discord embed support
✅ **Error Resilient**: Auto-deactivates in inaccessible channels
✅ **Audit Logging**: Tracks all sticky operations

## Common Scenarios

### Scenario 1: Keep Channel Rules Visible
```
/stick channel:#rules content:"📋 Server Rules: [your rules]" interval:20 priority:100
/stickyconfig deleteoldmessage true
```

### Scenario 2: Auto-Adapt to Traffic
```
/stickyconfig mode activity
/stick channel:#general content:"💬 Welcome! Follow the rules." interval:5
```
The sticky will automatically re-appear sooner in busy channels.

### Scenario 3: Multiple Important Messages
```
/stick channel:#announcements content:"📢 Rule 1" priority:100 interval:10
/stick channel:#announcements content:"📢 Rule 2" priority:90 interval:10
/stick channel:#announcements content:"📢 Rule 3" priority:80 interval:10
```
Higher priority messages appear later (stay visible longer).

## Troubleshooting

**Sticky not appearing?**
- Check bot has "Send Messages" and "Manage Messages" permissions
- Verify bot can access the channel
- Check if module is enabled: `/stickyconfig view`

**Sticky disappearing too fast?**
- Increase the interval: `/stickyedit ... interval:15`
- Switch to activity mode: `/stickyconfig mode activity`

**Too many stickies?**
- Reduce maxStickiesPerChannel: `/stickyconfig maxstickies 2`
- Or remove lowest priority: `/unstick channel:...`

**Messages not sticking?**
- Check if sticky is marked active in database
- Verify channel ID is correct

## File Locations

All module files are in:
```
/sessions/relaxed-brave-curie/mnt/Bot 2026/Modules/StickyMessages/
```

## Support

For detailed documentation, see `README.md`
For implementation details, see `IMPLEMENTATION_SUMMARY.md`
