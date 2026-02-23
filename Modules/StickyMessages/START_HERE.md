# Sticky Messages Module - START HERE

Welcome! This document will help you navigate the Sticky Messages module and get started.

## What is This Module?

The Sticky Messages module automatically keeps important messages visible at the bottom of Discord channels by periodically deleting and resending them. It's "sticky" because it always returns to the bottom.

**Key Idea**: Keep important announcements, rules, or guidelines visible without them getting lost in conversation.

## Quick Navigation

Choose your starting point based on what you need:

### I Want to Understand What This Does
**Start with:** `README.md`
- Feature overview
- How it works
- What commands exist
- Configuration options
- Real-world examples

### I Want to Install and Use It
**Start with:** `QUICK_START.md`
- Installation steps
- Database setup (copy-paste SQL)
- Basic commands
- Common usage scenarios
- Troubleshooting

### I'm a Developer - Show Me the Code
**Start with:** `CODE_REFERENCE.md`
- Class definitions
- Method signatures
- Usage examples
- Common patterns
- How to extend

### I Want All the Technical Details
**Start with:** `COMPLETE_SUMMARY.txt`
- Complete feature list
- Full file breakdown
- Operation flows
- Error handling
- Performance metrics
- Deployment guide

### I Need Implementation Details
**Start with:** `IMPLEMENTATION_SUMMARY.md`
- File-by-file breakdown
- Feature implementations
- Type definitions
- Testing checklist

## The Absolute Minimum to Get Started

1. **Read:** README.md (5 min) - Understand what it does
2. **Setup:** Copy SQL from QUICK_START.md - Create database tables
3. **Install:** Copy StickyMessages folder to your `/Modules/` directory
4. **Configure:** Update your module loader
5. **Test:** Run `/stick` command to create your first sticky

## File Structure

```
StickyMessages/
├── START_HERE.md                    ← You are here
├── README.md                        ← Main documentation
├── QUICK_START.md                   ← Installation & setup
├── CODE_REFERENCE.md                ← Developer reference
├── IMPLEMENTATION_SUMMARY.md        ← Technical details
├── COMPLETE_SUMMARY.txt             ← Complete reference
│
├── Core Implementation (TypeScript):
├── tracker.ts                       ← Activity detection
├── helpers.ts                       ← Database operations
├── events.ts                        ← Discord event handlers
├── index.ts                         ← Module initialization
│
└── Commands (TypeScript):
    └── staff/
        ├── stick.ts                 ← /stick command
        ├── unstick.ts               ← /unstick command
        ├── stickyedit.ts            ← /stickyedit command
        └── config.ts                ← /stickyconfig command
```

## Key Concepts

### What is a Sticky Message?
A sticky message is a message that gets automatically re-sent to the bottom of a channel when it gets lost in conversation.

Example: Pin important rules so they stay visible even after 100 messages of conversation.

### How Does It Work?
1. User creates a sticky with `/stick` command
2. Bot sends the message to the channel
3. As new messages come in, bot tracks activity
4. When threshold is reached (5 messages, or activity-based):
   - Bot deletes old sticky message
   - Bot sends new one at the bottom
5. Repeat!

### Three Modes

**Interval Mode** (Simple)
- Re-stick after exactly 5 messages (or custom number)
- Good for: Quiet channels with consistent activity

**Activity Mode** (Smart)
- Re-stick based on how busy the channel is
- Fewer re-sticks in quiet channels
- More frequent in busy channels
- Good for: Mixed-activity servers

**Hybrid Mode** (Best)
- Minimum interval (e.g., 5 messages)
- But scales up if channel is busy
- Good for: Most situations

### Priority
If you have multiple stickies in one channel, higher priority ones re-appear later (stay visible longer).

## Commands at a Glance

| Command | What It Does |
|---------|--------------|
| `/stick` | Create a new sticky message |
| `/unstick` | Remove a sticky message |
| `/stickyedit` | Edit an existing sticky |
| `/stickyconfig view` | See current settings |
| `/stickyconfig mode` | Change interval/activity/hybrid |
| `/stickyconfig enabled` | Turn module on/off |
| `/stickyconfig maxstickies` | Change limit per channel |

## Configuration Options

Guild settings you can customize:

- **enabled**: Turn the module on/off (default: on)
- **mode**: interval, activity, or hybrid (default: interval)
- **maxStickiesPerChannel**: How many per channel (1-10, default: 3)
- **deleteBotMessage**: Delete old before sending new (default: yes)

## Common Scenarios

### Scenario 1: Rules Channel
```
/stick channel:#rules content:"📋 Read our server rules below" interval:20
```
Rules stay visible even with lots of discussion.

### Scenario 2: Adaptive General Chat
```
/stickyconfig mode activity
/stick channel:#general content:"Welcome! Follow the rules." interval:5
```
Automatically adjusts how often it appears based on traffic.

### Scenario 3: Multiple Priority Messages
```
/stick channel:#announcements content:"Important!" priority:100
/stick channel:#announcements content:"Also important!" priority:90
```
First message re-appears last (stays on screen longer).

## Integration Checklist

- [ ] Read README.md to understand features
- [ ] Copy SQL from QUICK_START.md and create tables
- [ ] Copy StickyMessages folder to /Modules/
- [ ] Update module loader to import the module
- [ ] Create database tables
- [ ] Test /stick command works
- [ ] Test /unstick command works
- [ ] Test /stickyconfig command works
- [ ] Configure permissions
- [ ] Deploy to production

## Troubleshooting

**Q: Sticky isn't appearing?**
A: Check README.md "Error Handling" section or QUICK_START.md "Troubleshooting"

**Q: How do I edit a sticky?**
A: Use `/stickyedit` command - see QUICK_START.md

**Q: How do I change when it re-sticks?**
A: Use interval parameter in `/stick`, or switch to activity mode with `/stickyconfig mode activity`

**Q: Can I have multiple stickies?**
A: Yes, up to 3 per channel (configurable). Use priority to order them.

## Documentation Map

```
Want to understand...          Read this
────────────────────────────────────────────
The basics                     README.md
How to install & setup         QUICK_START.md
The code structure             CODE_REFERENCE.md
All technical details          COMPLETE_SUMMARY.txt
Implementation specifics       IMPLEMENTATION_SUMMARY.md
This navigation guide          START_HERE.md (you are here)
```

## Next Steps

1. **First time?** → Read `README.md` (10 minutes)
2. **Ready to install?** → Follow `QUICK_START.md`
3. **Need code details?** → Check `CODE_REFERENCE.md`
4. **Want everything?** → See `COMPLETE_SUMMARY.txt`

## Support

All documentation is in this folder:
`/sessions/relaxed-brave-curie/mnt/Bot 2026/Modules/StickyMessages/`

Start with the document that matches what you need to do.

---

**Module Status:** Complete and Production Ready
**Last Updated:** 2026-02-22
**Version:** 1.0 - Initial Release
