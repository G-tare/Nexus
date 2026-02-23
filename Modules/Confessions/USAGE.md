# Confessions Module - Usage Guide

## Quick Start

### Step 1: Enable and Configure

1. Run `/confession-config channel` and select your confession channel
2. Run `/confession-config view` to verify settings

### Step 2: Test

- User runs `/confess message:"Hello world"`
- Confession posts to the channel as "Confession #1"
- User receives ephemeral confirmation

---

## Common Workflows

### Setting Up Moderation Queue

1. Create a private staff channel
2. Run `/confession-config moderation enabled:true channel:#moderation`
3. Staff uses `/confession-approve` or `/confession-deny` to review
4. Or use the approve/deny buttons on pending confession embeds

### Enabling Full Anonymity

1. Run `/confession-config anonymity enabled:true`
2. Server owner can NO LONGER use `/confession-reveal`
3. Only confessing users can be tracked via their hash for banning
4. Perfect for sensitive environments

### Disabling Full Anonymity (Default)

1. Run `/confession-config anonymity enabled:false`
2. Server owner can now use `/confession-reveal {id}` to see authors
3. User IDs are stored with confessions

### Managing Spam Words

1. Add words: `/confession-config blacklist-add word:spam`
2. Add more: `/confession-config blacklist-add word:scam`
3. View all: `/confession-config blacklist-list`
4. Remove: `/confession-config blacklist-remove word:spam`

### Banning a Troublemaker

Let's say confession #5 is abusive and you want to ban that user.

1. Run `/confession-ban ban confession-id:5`
2. That user is now banned (hash stored, not user ID)
3. If full anonymity is ON, you don't know who it was (perfect!)
4. If full anonymity is OFF, run `/confession-reveal id:5` first to see who

To see all banned users: `/confession-ban list`

To unban: `/confession-ban unban confession-id:5`

---

## Moderation Workflow with Queue

### Setup
```
/confession-config moderation enabled:true channel:#mod-queue
/confession-config color color:#FF0000
```

### User submits confession
- They see: "Your confession has been submitted for review"
- Moderation channel gets a numbered embed with approve/deny buttons
- Confession number is shown on the embed

### Staff reviews
- Click "Approve" button → Confession posts to main channel
- Click "Deny" button → Confession is deleted
- Or use `/confession-approve id:1` and `/confession-deny id:1 reason:inappropriate`

---

## Anonymity Scenarios

### Scenario 1: Discord Server (Default)
```
fullAnonymity: false
```
- Users confess anonymously in public
- Owner can private message them or reveal publicly
- Good for general community confession channels

### Scenario 2: Therapist Office or Sensitive Group
```
fullAnonymity: true
moderationEnabled: true
```
- Complete privacy - not even owner knows who confessed
- Moderation queue allows review without seeing author
- Ban users by confession ID if needed
- Perfect for high-trust environments

### Scenario 3: Gaming Community
```
fullAnonymity: false
moderationEnabled: false
cooldownSeconds: 60
```
- Fast posting, no approval needed
- Owner can reveal if someone confesses about abuse/threats
- Users can confess frequently

---

## Permission Setup

### Regular User
- Can only use `/confess`

### Moderator Role
- Grant `ManageMessages` permission
- Can use `/confession-approve`, `/confession-deny`, `/confession-ban`

### Admin/Owner Role
- Grant `ManageGuild` permission
- Can use `/confession-config`
- Owner specifically can use `/confession-reveal`

---

## Image Attachments

### Enable images:
```
/confession-config images enabled:true
```

### Disable images:
```
/confession-config images enabled:false
```

When enabled:
- Users can attach images to `/confess`
- Images are embedded in the confession post
- Image URL is stored (not the file)

---

## Cooldown Management

### Short cooldown (fast community):
```
/confession-config cooldown seconds:30
```

### Moderate cooldown (default):
```
/confession-config cooldown seconds:300
```

### Long cooldown (quality over quantity):
```
/confession-config cooldown seconds:3600
```

### No cooldown:
```
/confession-config cooldown seconds:0
```

---

## Customization

### Change Embed Color
```
/confession-config color color:#9B59B6
```

Popular colors:
- Purple: `#9B59B6`
- Blue: `#3498DB`
- Red: `#E74C3C`
- Green: `#27AE60`
- Gold: `#F39C12`
- Pink: `#FF69B4`

### View All Settings
```
/confession-config view
```

Shows:
- All enabled/disabled settings
- Current channel configuration
- Color and cooldown
- Number of blacklisted words
- Number of banned users
- Total confessions posted

---

## Troubleshooting

### "Confession channel is not configured"
**Fix**: Run `/confession-config channel` and select the channel

### "You are banned from confessing"
**Fix**: If you're staff, run `/confession-ban unban confession-id:{id}`

### "Your confession contains prohibited content"
**Fix**: Check `/confession-config blacklist-list` and avoid those words

### "Full anonymity is enabled"
(When trying to use `/confession-reveal`)

**Fix**:
- This is by design! Run `/confession-config anonymity enabled:false` if you need to reveal
- Or accept that confessions are fully anonymous

### Images not showing
**Fix**: Run `/confession-config images enabled:true`

### Moderation queue not working
**Fix**:
1. Verify `/confession-config view` shows `Moderation: Enabled`
2. Verify moderation channel is set
3. Check that the moderation channel still exists
4. Ensure staff member has `ManageMessages` permission

---

## Security Notes

1. **Full Anonymity Mode**: Best practice for sensitive communities. Once enabled, permanently prevents owner reveal.

2. **Blacklist**: Works case-insensitively. Use `/confession-config blacklist-add` to add multi-word phrases.

3. **User Hashing**: User IDs are hashed using SHA256 + guild ID + salt. Cannot be reversed. Banning does not reveal identity.

4. **Data Retention**:
   - Approved confessions: 365 days
   - Pending confessions: 7 days
   - Cooldowns: Per cooldown duration only
   - Redis-backed (data persists across bot restarts)

5. **Moderation**: Staff with `ManageMessages` can approve/deny via buttons or commands. No owner approval needed.

---

## Advanced Tips

### Private Moderation Channel
Only mods can see pending confessions:
```
Set moderation channel to a private staff-only channel
moderationChannelId will only be visible to staff
```

### Numbered Confession Archives
Keep the main confession channel clean by:
1. Setting moderation enabled
2. Reviewing and approving confessions daily
3. Denying spam/inappropriate confessions
4. Using `/confession-config view` to track total count

### Banned User Tracking
Even in full anonymity mode, you can:
1. Ban users by confession ID
2. They won't be able to confess anymore
3. You'll never know who they were (unless they tell you)
4. They can appeal and you can `/confession-ban unban` them

---

## Discord Channel Setup Tips

### Confession Channel Settings
- Disable read message history (privacy for sensitive channels)
- Allow webhooks (if using custom confession embeds)
- Set slow mode if needed (limits spam)

### Moderation Channel Settings
- Private staff-only
- Read-only or restricted posts
- Keep moderation quiet and professional

### Category Organization
```
📝 Confessions
├── #confessions (main channel)
└── 🔒 #mod-confessions (staff only)
```

---

## Limitations

- Max confession message: 2000 characters (Discord embed limit)
- Image attachments: URLs only (not stored as files)
- Confession numbers: Continue incrementing (no gaps)
- Full anonymity: Cannot be disabled once important data accumulated
- Cooldown: Applied after submission succeeds
