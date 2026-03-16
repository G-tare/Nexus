import { registerModuleConfig } from './configRegistry';

// ── Core ──

registerModuleConfig({
  moduleKey: 'core',
  label: 'Core',
  description: 'Core bot settings (help & config embeds)',
  emoji: '💎',
  category: 'Utility',
  fields: [
    { key: 'helpEmbedColors', type: 'boolean', label: 'Help Embed Colors', description: 'Use unique per-module colors in /help embeds', default: true },
    { key: 'configEmbedColors', type: 'boolean', label: 'Config Embed Colors', description: 'Use unique per-module colors in /configs embeds', default: true },
  ],
});

// ── Protection ──

registerModuleConfig({
  moduleKey: 'antiraid',
  label: 'Anti-Raid',
  description: 'Protect against mass join raids',
  emoji: '🛡️',
  category: 'Protection',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable anti-raid protection' },
    { key: 'joinThreshold', type: 'number', label: 'Join Threshold', description: 'Max joins before trigger', min: 2, max: 50, default: 10 },
    { key: 'joinWindow', type: 'number', label: 'Join Window (s)', description: 'Time window in seconds', min: 5, max: 120, default: 30 },
    { key: 'minAccountAge', type: 'number', label: 'Min Account Age (days)', description: 'Minimum days since account creation', min: 0, max: 365, default: 7 },
    { key: 'autoLockdown', type: 'boolean', label: 'Auto Lockdown', description: 'Automatically lock server during raid' },
    { key: 'alertChannelId', type: 'channel', label: 'Alert Channel', description: 'Channel for raid alerts' },
    { key: 'quarantineRoleId', type: 'role', label: 'Quarantine Role', description: 'Role assigned to suspected raiders' },
    { key: 'action', type: 'choice', label: 'Action', description: 'What to do with raiders', choices: [
      { label: 'Kick', value: 'kick' },
      { label: 'Ban', value: 'ban' },
      { label: 'Quarantine', value: 'quarantine' },
    ] },
  ],
});

registerModuleConfig({
  moduleKey: 'automod',
  label: 'Auto Mod',
  description: 'Automatic moderation and content filtering',
  emoji: '🤖',
  category: 'Protection',
  fields: [
    { key: 'logChannelId', type: 'channel', label: 'Log Channel', description: 'Channel for automod logs' },
  ],
});

// ── Moderation ──

registerModuleConfig({
  moduleKey: 'moderation',
  label: 'Moderation',
  description: 'Core moderation settings',
  emoji: '🔨',
  category: 'Moderation',
  fields: [
    { key: 'dmOnBan', type: 'boolean', label: 'DM on Ban', description: 'DM users when they are banned', default: true },
    { key: 'dmOnKick', type: 'boolean', label: 'DM on Kick', description: 'DM users when they are kicked', default: true },
    { key: 'dmOnMute', type: 'boolean', label: 'DM on Mute', description: 'DM users when they are muted', default: true },
    { key: 'dmOnWarn', type: 'boolean', label: 'DM on Warn', description: 'DM users when they are warned', default: true },
    { key: 'requireReason', type: 'boolean', label: 'Require Reason', description: 'Require a reason for mod actions' },
    { key: 'appealEnabled', type: 'boolean', label: 'Appeals', description: 'Allow users to appeal punishments' },
    { key: 'shadowBanEnabled', type: 'boolean', label: 'Shadow Ban', description: 'Enable shadow ban feature' },
    { key: 'quarantineRoleId', type: 'role', label: 'Quarantine Role', description: 'Role for quarantined users' },
    { key: 'watchlistChannelId', type: 'channel', label: 'Watchlist Channel', description: 'Channel for watchlist alerts' },
  ],
});

registerModuleConfig({
  moduleKey: 'logging',
  label: 'Logging',
  description: 'Server event logging',
  emoji: '📋',
  category: 'Moderation',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable server logging' },
    { key: 'defaultChannelId', type: 'channel', label: 'Default Log Channel', description: 'Default channel for all logs' },
  ],
});

// ── Engagement ──

registerModuleConfig({
  moduleKey: 'leveling',
  label: 'Leveling',
  description: 'XP and level-up system',
  emoji: '📈',
  category: 'Engagement',
  fields: [
    { key: 'xpCooldownSeconds', type: 'number', label: 'XP Cooldown (s)', description: 'Seconds between XP gains', min: 0, max: 300, default: 60 },
    { key: 'xpPerVoiceMinute', type: 'number', label: 'Voice XP/min', description: 'XP earned per minute in voice', min: 0, max: 50, default: 3 },
    { key: 'voiceRequireUnmuted', type: 'boolean', label: 'Require Unmuted', description: 'Only earn voice XP when unmuted' },
    { key: 'stackRoles', type: 'boolean', label: 'Stack Roles', description: 'Keep all level roles or only highest' },
    { key: 'doubleXpActive', type: 'boolean', label: 'Double XP', description: 'Double XP event active' },
    { key: 'prestigeEnabled', type: 'boolean', label: 'Prestige', description: 'Enable prestige system' },
    { key: 'announceType', type: 'choice', label: 'Level-Up Announce', description: 'Where to announce level ups', choices: [
      { label: 'Current Channel', value: 'current' },
      { label: 'Specific Channel', value: 'channel' },
      { label: 'DM', value: 'dm' },
      { label: 'Off', value: 'off' },
    ] },
    { key: 'announceChannelId', type: 'channel', label: 'Announce Channel', description: 'Channel for level-up messages' },
  ],
});

registerModuleConfig({
  moduleKey: 'counting',
  label: 'Counting',
  description: 'Counting game channel',
  emoji: '🔢',
  category: 'Engagement',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable counting module' },
    { key: 'channelId', type: 'channel', label: 'Channel', description: 'The counting channel' },
    { key: 'allowDoubleCount', type: 'boolean', label: 'Allow Double Count', description: 'Let same user count twice in a row' },
    { key: 'mathEnabled', type: 'boolean', label: 'Math Enabled', description: 'Allow math expressions' },
    { key: 'defaultLives', type: 'number', label: 'Lives', description: 'Default lives per user', min: 0, max: 99, default: 3 },
    { key: 'streakBonusEnabled', type: 'boolean', label: 'Streak Bonus', description: 'Enable streak bonus rewards' },
  ],
});

registerModuleConfig({
  moduleKey: 'reputation',
  label: 'Reputation',
  description: 'User reputation system',
  emoji: '⭐',
  category: 'Engagement',
  fields: [
    { key: 'dailyLimit', type: 'number', label: 'Daily Limit', description: 'Max rep given per day', min: 1, max: 100, default: 3 },
    { key: 'decayEnabled', type: 'boolean', label: 'Rep Decay', description: 'Enable reputation decay over time' },
    { key: 'reactionRepEnabled', type: 'boolean', label: 'Reaction Rep', description: 'Give rep via reactions' },
    { key: 'allowSelfRep', type: 'boolean', label: 'Self Rep', description: 'Allow giving rep to yourself' },
    { key: 'allowNegative', type: 'boolean', label: 'Negative Rep', description: 'Allow negative reputation' },
    { key: 'logChannelId', type: 'channel', label: 'Log Channel', description: 'Channel for rep logs' },
  ],
});

registerModuleConfig({
  moduleKey: 'giveaways',
  label: 'Giveaways',
  description: 'Server giveaways',
  emoji: '🎉',
  category: 'Engagement',
  fields: [
    { key: 'buttonMode', type: 'boolean', label: 'Button Mode', description: 'Use buttons instead of reactions' },
    { key: 'dmWinners', type: 'boolean', label: 'DM Winners', description: 'DM winners when they win' },
    { key: 'allowSelfEntry', type: 'boolean', label: 'Self Entry', description: 'Allow host to enter own giveaway' },
    { key: 'maxActive', type: 'number', label: 'Max Active', description: 'Max concurrent giveaways', min: 1, max: 50, default: 10 },
    { key: 'defaultChannel', type: 'channel', label: 'Default Channel', description: 'Default giveaway channel' },
    { key: 'pingRole', type: 'role', label: 'Ping Role', description: 'Role to ping for new giveaways' },
  ],
});

registerModuleConfig({
  moduleKey: 'polls',
  label: 'Polls',
  description: 'Server polls',
  emoji: '📊',
  category: 'Engagement',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable polls module' },
    { key: 'maxOptions', type: 'number', label: 'Max Options', description: 'Maximum poll options', min: 2, max: 25, default: 10 },
    { key: 'allowAnonymous', type: 'boolean', label: 'Anonymous', description: 'Allow anonymous polls' },
  ],
});

registerModuleConfig({
  moduleKey: 'suggestions',
  label: 'Suggestions',
  description: 'Server suggestions system',
  emoji: '💡',
  category: 'Engagement',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable suggestions module' },
  ],
});

registerModuleConfig({
  moduleKey: 'quoteboard',
  label: 'Quote Board',
  description: 'Save notable messages to a board',
  emoji: '⭐',
  category: 'Engagement',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable quote board' },
    { key: 'defaultThreshold', type: 'number', label: 'Threshold', description: 'Reactions needed to pin', min: 1, max: 50, default: 3 },
    { key: 'selfStar', type: 'boolean', label: 'Self Star', description: 'Allow self-starring' },
    { key: 'ignoreBots', type: 'boolean', label: 'Ignore Bots', description: 'Ignore bot messages' },
  ],
});

// ── Economy ──

registerModuleConfig({
  moduleKey: 'currency',
  label: 'Currency',
  description: 'Server economy system',
  emoji: '💰',
  category: 'Economy',
  fields: [
    { key: 'sendCap', type: 'number', label: 'Send Cap', description: 'Max amount per transfer', min: 0, max: 1000000, default: 10000 },
    { key: 'taxPercent', type: 'number', label: 'Tax %', description: 'Tax on transfers', min: 0, max: 50, default: 0 },
  ],
});

registerModuleConfig({
  moduleKey: 'shop',
  label: 'Shop',
  description: 'Server shop for items',
  emoji: '🛒',
  category: 'Economy',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable shop module' },
    { key: 'taxPercent', type: 'number', label: 'Tax %', description: 'Tax on purchases', min: 0, max: 50, default: 0 },
    { key: 'refundsEnabled', type: 'boolean', label: 'Refunds', description: 'Allow item refunds' },
    { key: 'refundPercent', type: 'number', label: 'Refund %', description: 'Percentage refunded', min: 0, max: 100, default: 80 },
    { key: 'showOutOfStock', type: 'boolean', label: 'Show OOS', description: 'Show out of stock items' },
  ],
});

registerModuleConfig({
  moduleKey: 'leaderboards',
  label: 'Leaderboards',
  description: 'Server leaderboards',
  emoji: '🏆',
  category: 'Economy',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable leaderboards' },
    { key: 'entriesPerPage', type: 'number', label: 'Entries/Page', description: 'Entries per leaderboard page', min: 5, max: 25, default: 10 },
  ],
});

// ── Entertainment ──

registerModuleConfig({
  moduleKey: 'music',
  label: 'Music',
  description: 'Music playback settings',
  emoji: '🎵',
  category: 'Entertainment',
  fields: [
    { key: 'defaultVolume', type: 'number', label: 'Default Volume', description: 'Default playback volume', min: 1, max: 150, default: 80 },
    { key: 'maxVolume', type: 'number', label: 'Max Volume', description: 'Maximum allowed volume', min: 1, max: 200, default: 150 },
    { key: 'maxQueueSize', type: 'number', label: 'Max Queue', description: 'Max tracks in queue', min: 1, max: 5000, default: 500 },
    { key: 'voteSkipEnabled', type: 'boolean', label: 'Vote Skip', description: 'Enable vote skip' },
    { key: 'voteSkipPercent', type: 'number', label: 'Vote Skip %', description: 'Percent needed to skip', min: 1, max: 100, default: 50 },
    { key: 'announceNowPlaying', type: 'boolean', label: 'Announce NP', description: 'Announce now playing' },
    { key: 'autoplayEnabled', type: 'boolean', label: 'Autoplay', description: 'Auto-play related tracks' },
    { key: 'djEnabled', type: 'boolean', label: 'DJ System', description: 'Enable DJ role system' },
    { key: 'djRoleId', type: 'role', label: 'DJ Role', description: 'The DJ role' },
    { key: 'leaveOnEmpty', type: 'boolean', label: 'Leave on Empty', description: 'Leave when VC is empty' },
    { key: 'twentyFourSeven', type: 'boolean', label: '24/7 Mode', description: 'Stay in VC permanently' },
  ],
});

registerModuleConfig({
  moduleKey: 'fun',
  label: 'Fun',
  description: 'Fun games and commands',
  emoji: '🎮',
  category: 'Entertainment',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable fun module' },
  ],
});

// ── Voice ──

registerModuleConfig({
  moduleKey: 'tempvoice',
  label: 'Temp Voice',
  description: 'Temporary voice channels',
  emoji: '🔊',
  category: 'Voice',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable temp voice channels' },
    { key: 'categoryId', type: 'channel', label: 'Category', description: 'Category for temp channels' },
    { key: 'lobbyChannelId', type: 'channel', label: 'Lobby Channel', description: 'Join-to-create channel' },
    { key: 'defaultUserLimit', type: 'number', label: 'User Limit', description: 'Default user limit', min: 0, max: 99, default: 0 },
    { key: 'nameTemplate', type: 'string', label: 'Name Template', description: 'Channel name template ({user})' },
  ],
});

registerModuleConfig({
  moduleKey: 'userphone',
  label: 'Userphone',
  description: 'Cross-server text calls',
  emoji: '📞',
  category: 'Voice',
  fields: [
    { key: 'maxDuration', type: 'number', label: 'Max Duration (m)', description: 'Max call duration in minutes', min: 1, max: 60, default: 15 },
    { key: 'allowAttachments', type: 'boolean', label: 'Attachments', description: 'Allow image attachments' },
    { key: 'showServerName', type: 'boolean', label: 'Show Server', description: 'Show server name in calls' },
  ],
});

// ── Social ──

registerModuleConfig({
  moduleKey: 'welcome',
  label: 'Welcome',
  description: 'Welcome and goodbye messages',
  emoji: '👋',
  category: 'Social',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable welcome module' },
  ],
});

registerModuleConfig({
  moduleKey: 'birthdays',
  label: 'Birthdays',
  description: 'Birthday announcements',
  emoji: '🎂',
  category: 'Social',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable birthday system' },
    { key: 'channelId', type: 'channel', label: 'Channel', description: 'Birthday announcement channel' },
    { key: 'roleId', type: 'role', label: 'Birthday Role', description: 'Role given on birthday' },
    { key: 'dmNotification', type: 'boolean', label: 'DM Notify', description: 'DM users on birthday' },
    { key: 'showAge', type: 'boolean', label: 'Show Age', description: 'Show age in announcements' },
  ],
});

registerModuleConfig({
  moduleKey: 'confessions',
  label: 'Confessions',
  description: 'Anonymous confessions',
  emoji: '🤫',
  category: 'Social',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable confessions' },
    { key: 'channelId', type: 'channel', label: 'Channel', description: 'Confessions channel' },
    { key: 'requireApproval', type: 'boolean', label: 'Require Approval', description: 'Staff must approve confessions' },
    { key: 'allowImages', type: 'boolean', label: 'Allow Images', description: 'Allow image attachments' },
  ],
});

registerModuleConfig({
  moduleKey: 'afk',
  label: 'AFK',
  description: 'Away from keyboard status',
  emoji: '💤',
  category: 'Social',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable AFK module' },
    { key: 'autoRemoveOnMessage', type: 'boolean', label: 'Auto Remove', description: 'Remove AFK when user messages' },
    { key: 'dmPingsOnReturn', type: 'boolean', label: 'DM Pings', description: 'DM missed pings when returning' },
    { key: 'maxMessageLength', type: 'number', label: 'Max Length', description: 'Max AFK message length', min: 10, max: 500, default: 200 },
  ],
});

// ── Utility ──

registerModuleConfig({
  moduleKey: 'tickets',
  label: 'Tickets',
  description: 'Support ticket system',
  emoji: '🎫',
  category: 'Utility',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable tickets' },
  ],
});

registerModuleConfig({
  moduleKey: 'reminders',
  label: 'Reminders',
  description: 'Personal reminders',
  emoji: '⏰',
  category: 'Utility',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable reminders' },
    { key: 'maxReminders', type: 'number', label: 'Max Reminders', description: 'Max active reminders per user', min: 1, max: 50, default: 10 },
  ],
});

registerModuleConfig({
  moduleKey: 'scheduledmessages',
  label: 'Scheduled Messages',
  description: 'Schedule recurring messages',
  emoji: '📅',
  category: 'Utility',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable scheduled messages' },
    { key: 'maxScheduledPerGuild', type: 'number', label: 'Max Scheduled', description: 'Max scheduled messages', min: 1, max: 100, default: 25 },
    { key: 'timezone', type: 'string', label: 'Timezone', description: 'Default timezone (e.g. America/New_York)' },
  ],
});

registerModuleConfig({
  moduleKey: 'stickymessages',
  label: 'Sticky Messages',
  description: 'Messages that stick to bottom of channels',
  emoji: '📌',
  category: 'Utility',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable sticky messages' },
  ],
});

registerModuleConfig({
  moduleKey: 'backup',
  label: 'Backup',
  description: 'Server backup system',
  emoji: '💾',
  category: 'Utility',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable backups' },
    { key: 'maxBackups', type: 'number', label: 'Max Backups', description: 'Max stored backups', min: 1, max: 10, default: 5 },
  ],
});

registerModuleConfig({
  moduleKey: 'translation',
  label: 'Translation',
  description: 'Message translation',
  emoji: '🌐',
  category: 'Utility',
  fields: [
    { key: 'flagReactions', type: 'boolean', label: 'Flag Reactions', description: 'Translate via flag reactions' },
    { key: 'autoDetect', type: 'boolean', label: 'Auto Detect', description: 'Auto-detect language' },
  ],
});

registerModuleConfig({
  moduleKey: 'autoroles',
  label: 'Auto Roles',
  description: 'Automatic role assignment',
  emoji: '🏷️',
  category: 'Utility',
  fields: [
    { key: 'persistentRoles', type: 'boolean', label: 'Persistent', description: 'Restore roles on rejoin' },
    { key: 'ignoreBots', type: 'boolean', label: 'Ignore Bots', description: 'Don\'t assign to bots' },
    { key: 'stackRoles', type: 'boolean', label: 'Stack Roles', description: 'Stack multiple auto-roles' },
    { key: 'logChannelId', type: 'channel', label: 'Log Channel', description: 'Channel for role assignment logs' },
  ],
});

registerModuleConfig({
  moduleKey: 'colorroles',
  label: 'Color Roles',
  description: 'Custom color roles for members',
  emoji: '🎨',
  category: 'Utility',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable color roles' },
    { key: 'maxColors', type: 'number', label: 'Max Colors', description: 'Max color roles allowed', min: 1, max: 50, default: 20 },
    { key: 'whitelistEnabled', type: 'boolean', label: 'Whitelist', description: 'Only whitelisted roles can use' },
    { key: 'overlapWarning', type: 'boolean', label: 'Overlap Warning', description: 'Warn about similar colors' },
  ],
});

registerModuleConfig({
  moduleKey: 'reactionroles',
  label: 'Reaction Roles',
  description: 'Reaction-based role assignment',
  emoji: '🎭',
  category: 'Utility',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable reaction roles' },
  ],
});

registerModuleConfig({
  moduleKey: 'forms',
  label: 'Forms',
  description: 'Custom forms and applications',
  emoji: '📝',
  category: 'Utility',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable forms module' },
    { key: 'requireApproval', type: 'boolean', label: 'Require Approval', description: 'Staff must approve submissions' },
    { key: 'submissionChannelId', type: 'channel', label: 'Submissions Channel', description: 'Channel for form submissions' },
  ],
});

registerModuleConfig({
  moduleKey: 'customcommands',
  label: 'Custom Commands',
  description: 'Server custom commands',
  emoji: '⚡',
  category: 'Utility',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable custom commands' },
    { key: 'prefix', type: 'string', label: 'Prefix', description: 'Custom command prefix' },
    { key: 'maxCommands', type: 'number', label: 'Max Commands', description: 'Max custom commands', min: 1, max: 200, default: 50 },
  ],
});

registerModuleConfig({
  moduleKey: 'invitetracker',
  label: 'Invite Tracker',
  description: 'Track server invites',
  emoji: '📨',
  category: 'Utility',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable invite tracking' },
    { key: 'trackFakes', type: 'boolean', label: 'Track Fakes', description: 'Track fake/alt invites' },
    { key: 'announceJoins', type: 'boolean', label: 'Announce', description: 'Announce who invited new members' },
  ],
});

registerModuleConfig({
  moduleKey: 'messagetracking',
  label: 'Message Tracking',
  description: 'Track message edits and deletes',
  emoji: '👁️',
  category: 'Utility',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable message tracking' },
    { key: 'snipeEnabled', type: 'boolean', label: 'Snipe', description: 'Enable /snipe command' },
    { key: 'ghostPingAlert', type: 'boolean', label: 'Ghost Ping Alert', description: 'Alert on ghost pings' },
    { key: 'ignoreBots', type: 'boolean', label: 'Ignore Bots', description: 'Ignore bot messages' },
    { key: 'logChannelId', type: 'channel', label: 'Log Channel', description: 'Channel for message logs' },
  ],
});

registerModuleConfig({
  moduleKey: 'statschannels',
  label: 'Stats Channels',
  description: 'Live server statistics channels',
  emoji: '📊',
  category: 'Utility',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable stats channels' },
    { key: 'updateInterval', type: 'number', label: 'Update Interval (m)', description: 'Minutes between updates', min: 5, max: 60, default: 10 },
  ],
});

registerModuleConfig({
  moduleKey: 'activitytracking',
  label: 'Activity Tracking',
  description: 'Track member activity',
  emoji: '📈',
  category: 'Utility',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable activity tracking' },
    { key: 'trackVoice', type: 'boolean', label: 'Track Voice', description: 'Track voice activity' },
    { key: 'trackMessages', type: 'boolean', label: 'Track Messages', description: 'Track message activity' },
    { key: 'inactiveThresholdDays', type: 'number', label: 'Inactive Threshold', description: 'Days before marked inactive', min: 1, max: 365, default: 30 },
    { key: 'logChannelId', type: 'channel', label: 'Log Channel', description: 'Channel for activity logs' },
  ],
});

// ── AI ──

registerModuleConfig({
  moduleKey: 'aichatbot',
  label: 'AI Chatbot',
  description: 'AI conversation and agent system',
  emoji: '🤖',
  category: 'Entertainment',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable AI chatbot' },
    { key: 'autoReply', type: 'boolean', label: 'Auto Reply', description: 'Auto-reply in allowed channels' },
    { key: 'mentionReply', type: 'boolean', label: 'Mention Reply', description: 'Reply when mentioned' },
    { key: 'agentEnabled', type: 'boolean', label: 'Agent Mode', description: 'Enable AI agent with tools' },
    { key: 'confirmDestructive', type: 'boolean', label: 'Confirm Actions', description: 'Confirm destructive agent actions' },
    { key: 'maxTokens', type: 'number', label: 'Max Tokens', description: 'Max response tokens', min: 100, max: 8000, default: 1024 },
    { key: 'cooldown', type: 'number', label: 'Cooldown (s)', description: 'Seconds between messages', min: 0, max: 60, default: 3 },
    { key: 'conversationTimeout', type: 'number', label: 'Timeout (min)', description: 'Conversation timeout', min: 1, max: 30, default: 10 },
  ],
});

// ── Raffles ──

registerModuleConfig({
  moduleKey: 'raffles',
  label: 'Raffles',
  description: 'Ticket-based raffle system with currency integration',
  emoji: '🎟️',
  category: 'Engagement',
  fields: [
    { key: 'ticketPrice', type: 'number', label: 'Ticket Price', description: 'Cost per ticket in currency', min: 0, max: 100000, default: 100 },
    { key: 'currencyType', type: 'choice', label: 'Currency', description: 'Currency used for tickets', choices: [
      { label: 'Coins', value: 'coins' },
      { label: 'Gems', value: 'gems' },
      { label: 'Event Tokens', value: 'event_tokens' },
    ] },
    { key: 'maxTicketsPerUser', type: 'number', label: 'Max Tickets/User', description: 'Max tickets per user per raffle', min: 1, max: 1000, default: 10 },
    { key: 'maxActive', type: 'number', label: 'Max Active', description: 'Max concurrent raffles', min: 1, max: 50, default: 10 },
    { key: 'dmWinners', type: 'boolean', label: 'DM Winners', description: 'DM winners when they win' },
    { key: 'refundOnCancel', type: 'boolean', label: 'Refund on Cancel', description: 'Refund tickets when raffle is cancelled' },
    { key: 'defaultChannelId', type: 'channel', label: 'Default Channel', description: 'Default raffle channel' },
    { key: 'pingRoleId', type: 'role', label: 'Ping Role', description: 'Role to ping for new raffles' },
  ],
});

// ── Donation Tracking ──

registerModuleConfig({
  moduleKey: 'donationtracking',
  label: 'Donation Tracking',
  description: 'Track donations with goals and leaderboards',
  emoji: '💝',
  category: 'Economy',
  fields: [
    { key: 'currencyType', type: 'choice', label: 'Currency', description: 'Currency used for donations', choices: [
      { label: 'Coins', value: 'coins' },
      { label: 'Gems', value: 'gems' },
      { label: 'Event Tokens', value: 'event_tokens' },
    ] },
    { key: 'goalActive', type: 'boolean', label: 'Goal Active', description: 'Enable donation goal tracking' },
    { key: 'goalName', type: 'string', label: 'Goal Name', description: 'Name of the current donation goal' },
    { key: 'goalAmount', type: 'number', label: 'Goal Amount', description: 'Target donation amount', min: 0, max: 10000000, default: 0 },
    { key: 'announceMilestones', type: 'boolean', label: 'Milestones', description: 'Announce donation milestones' },
    { key: 'minDonation', type: 'number', label: 'Min Donation', description: 'Minimum donation amount', min: 1, max: 100000, default: 1 },
    { key: 'maxDonation', type: 'number', label: 'Max Donation', description: 'Maximum donation amount', min: 1, max: 1000000, default: 50000 },
    { key: 'leaderboardSize', type: 'number', label: 'Leaderboard Size', description: 'Entries on leaderboard', min: 5, max: 50, default: 10 },
    { key: 'defaultChannelId', type: 'channel', label: 'Default Channel', description: 'Default donation channel' },
    { key: 'logChannelId', type: 'channel', label: 'Log Channel', description: 'Channel for milestone logs' },
  ],
});

// ── Timers ──

registerModuleConfig({
  moduleKey: 'timers',
  label: 'Timers',
  description: 'General-purpose countdown timers',
  emoji: '⏱️',
  category: 'Utility',
  fields: [
    { key: 'maxPerUser', type: 'number', label: 'Max Per User', description: 'Max active timers per user', min: 1, max: 50, default: 5 },
    { key: 'allowDm', type: 'boolean', label: 'Allow DM', description: 'Allow DM notifications when timer ends' },
    { key: 'defaultNotifyChannelId', type: 'channel', label: 'Notify Channel', description: 'Default channel for timer notifications' },
    { key: 'logChannelId', type: 'channel', label: 'Log Channel', description: 'Channel for timer logs' },
  ],
});

// ── Casino ──

registerModuleConfig({
  moduleKey: 'casino',
  label: 'Casino',
  description: 'Gambling games with currency integration',
  emoji: '🎰',
  category: 'Economy',
  fields: [
    { key: 'minBet', type: 'number', label: 'Min Bet', description: 'Minimum bet amount', min: 1, max: 10000, default: 10 },
    { key: 'maxBet', type: 'number', label: 'Max Bet', description: 'Maximum bet amount', min: 100, max: 1000000, default: 50000 },
    { key: 'currencyType', type: 'choice', label: 'Currency', description: 'Currency used for bets', choices: [
      { label: 'Coins', value: 'coins' },
      { label: 'Gems', value: 'gems' },
    ] },
    { key: 'cooldown', type: 'number', label: 'Cooldown (s)', description: 'Seconds between games', min: 0, max: 60, default: 10 },
    { key: 'logChannelId', type: 'channel', label: 'Log Channel', description: 'Channel for win/loss logs' },
  ],
});

// ── Profile ──

registerModuleConfig({
  moduleKey: 'profile',
  label: 'Profile',
  description: 'Customizable user profiles',
  emoji: '👤',
  category: 'Social',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable profiles' },
    { key: 'maxListItems', type: 'number', label: 'Max List Items', description: 'Max items per list category', min: 1, max: 25, default: 10 },
    { key: 'requireCreate', type: 'boolean', label: 'Require Create', description: 'Require /profile create first' },
  ],
});

// ── Family ──

registerModuleConfig({
  moduleKey: 'family',
  label: 'Family',
  description: 'Family tree with marriage and adoption',
  emoji: '👨‍👩‍👧',
  category: 'Social',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable family system' },
    { key: 'maxChildren', type: 'number', label: 'Max Children', description: 'Max children per user', min: 1, max: 20, default: 10 },
    { key: 'proposalExpiry', type: 'number', label: 'Proposal Expiry (s)', description: 'Seconds before proposals expire', min: 3600, max: 604800, default: 86400 },
  ],
});

// ── Images ──

registerModuleConfig({
  moduleKey: 'images',
  label: 'Images',
  description: 'Image generation and animal pics',
  emoji: '🖼️',
  category: 'Fun',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable images module' },
    { key: 'cooldown', type: 'number', label: 'Cooldown (s)', description: 'Seconds between commands', min: 0, max: 30, default: 5 },
  ],
});

// ── Utilities ──

registerModuleConfig({
  moduleKey: 'utilities',
  label: 'Utilities',
  description: 'Search, tools, and notepad',
  emoji: '🔧',
  category: 'Utility',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable utilities' },
    { key: 'searchCooldown', type: 'number', label: 'Search Cooldown (s)', description: 'Seconds between searches', min: 0, max: 30, default: 5 },
    { key: 'maxNotes', type: 'number', label: 'Max Notes', description: 'Max notes per user', min: 5, max: 100, default: 25 },
    { key: 'notepadEnabled', type: 'boolean', label: 'Notepad', description: 'Enable notepad feature' },
  ],
});

// ── Soundboard ──

registerModuleConfig({
  moduleKey: 'soundboard',
  label: 'Soundboard',
  description: 'Sound effects in voice channels',
  emoji: '🔊',
  category: 'Fun',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable soundboard' },
    { key: 'maxCustomSounds', type: 'number', label: 'Max Custom Sounds', description: 'Max custom sounds per server', min: 5, max: 100, default: 25 },
    { key: 'allowUserUpload', type: 'boolean', label: 'User Upload', description: 'Allow non-staff to add sounds' },
    { key: 'cooldown', type: 'number', label: 'Cooldown (s)', description: 'Seconds between plays', min: 0, max: 30, default: 5 },
  ],
});

// ── Autosetup ──

registerModuleConfig({
  moduleKey: 'autosetup',
  label: 'Auto Setup',
  description: 'One-command server setup wizard',
  emoji: '⚙️',
  category: 'Utility',
  fields: [
    { key: 'enabled', type: 'boolean', label: 'Enabled', description: 'Enable auto setup' },
    { key: 'categoryName', type: 'string', label: 'Category Name', description: 'Default category name for created channels' },
  ],
});
