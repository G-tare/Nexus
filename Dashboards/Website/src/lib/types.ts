export interface User {
  id: string;
  username: string;
  avatar: string | null;
  isOwner: boolean;
}

export interface Guild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
  features: string[];
}

export interface GuildWithBot extends Guild {
  botActive: boolean;
}

export interface ModuleConfig {
  enabled: boolean;
  config: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

export interface Channel {
  id: string;
  name: string;
  type: number;
  position: number;
  parentId: string | null;
}

export interface GuildStats {
  totalMembers: number;
  totalMessages: number;
  totalVoiceMinutes: number;
  averageLevel: number;
  highestLevel: number;
}

export interface ModCase {
  id: number;
  guildId: string;
  caseNumber: number;
  action: string;
  userId: string;
  moderatorId: string;
  reason: string | null;
  duration: string | null;
  isActive: boolean;
  createdAt: string;
  username: string | null;
  moderatorUsername: string | null;
}

export interface AutomodLog {
  id: number;
  guildId: string;
  targetId: string;
  action: string;
  violationType: string;
  reason: string | null;
  messageContent: string | null;
  channelId: string | null;
  duration: string | null;
  createdAt: string;
  username: string | null;
}

export interface ActivityPoint {
  label: string;
  messages: number;
  voiceMinutes: number;
  reactions: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  value: number;
}

export interface PermissionRule {
  id: number;
  command: string;
  targetType: 'role' | 'user' | 'channel';
  targetId: string;
  allowed: boolean;
  resolvedName?: string;
}

// Owner dashboard types
export interface PremiumBreakdown {
  tier: string;
  count: number;
}

export interface OwnerStats {
  totalGuilds: number;
  premiumBreakdown: PremiumBreakdown[];
  timestamp: string;
}

export interface OwnerGuild {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number | null;
  premiumTier: string | null;
  premiumExpiresAt: string | null;
  isActive: boolean;
}

export interface OwnerGuildsResponse {
  guilds: OwnerGuild[];
  page: number;
  limit: number;
  total?: number;
}

// Module registry — must match iOS app and bot module names
export const MODULE_REGISTRY: { key: string; name: string; icon: string; category: string }[] = [
  { key: 'core', name: 'Core', icon: '💎', category: 'utility' },
  { key: 'moderation', name: 'Moderation', icon: '🛡️', category: 'moderation' },
  { key: 'automod', name: 'Auto Mod', icon: '🤖', category: 'moderation' },
  { key: 'antiraid', name: 'Anti-Raid', icon: '⚠️', category: 'moderation' },
  { key: 'logging', name: 'Logging', icon: '📝', category: 'moderation' },
  { key: 'leveling', name: 'Leveling', icon: '⭐', category: 'engagement' },
  { key: 'activitytracking', name: 'Activity Tracking', icon: '📊', category: 'engagement' },
  { key: 'reputation', name: 'Reputation', icon: '🌟', category: 'engagement' },
  { key: 'leaderboards', name: 'Leaderboards', icon: '🏆', category: 'engagement' },
  { key: 'fun', name: 'Fun', icon: '🎮', category: 'fun' },
  { key: 'music', name: 'Music', icon: '🎵', category: 'fun' },
  { key: 'polls', name: 'Polls', icon: '📊', category: 'fun' },
  { key: 'counting', name: 'Counting', icon: '🔢', category: 'fun' },
  { key: 'casino', name: 'Casino', icon: '🎰', category: 'economy' },
  { key: 'currency', name: 'Currency', icon: '💰', category: 'economy' },
  { key: 'shop', name: 'Shop', icon: '🛒', category: 'economy' },
  { key: 'donationtracking', name: 'Donations', icon: '💝', category: 'economy' },
  { key: 'tickets', name: 'Tickets', icon: '🎫', category: 'utility' },
  { key: 'welcome', name: 'Welcome', icon: '👋', category: 'utility' },
  { key: 'autoroles', name: 'Auto Roles', icon: '🎭', category: 'utility' },
  { key: 'reactionroles', name: 'Reaction Roles', icon: '🎯', category: 'utility' },
  { key: 'colorroles', name: 'Color Roles', icon: '🌈', category: 'utility' },
  { key: 'backup', name: 'Backup', icon: '💾', category: 'utility' },
  { key: 'reminders', name: 'Reminders', icon: '⏰', category: 'utility' },
  { key: 'scheduledmessages', name: 'Scheduled Messages', icon: '📅', category: 'utility' },
  { key: 'giveaways', name: 'Giveaways', icon: '🎁', category: 'utility' },
  { key: 'forms', name: 'Forms', icon: '📋', category: 'utility' },
  { key: 'suggestions', name: 'Suggestions', icon: '💡', category: 'utility' },
  { key: 'confessions', name: 'Confessions', icon: '🗣️', category: 'social' },
  { key: 'quoteboard', name: 'Quote Board', icon: '✨', category: 'social' },
  { key: 'birthdays', name: 'Birthdays', icon: '🎂', category: 'social' },
  { key: 'afk', name: 'AFK', icon: '💤', category: 'social' },
  { key: 'aichatbot', name: 'AI Chatbot', icon: '🧠', category: 'social' },
  { key: 'userphone', name: 'Userphone', icon: '📞', category: 'social' },
  { key: 'profile', name: 'Profile', icon: '👤', category: 'social' },
  { key: 'family', name: 'Family', icon: '👪', category: 'social' },
  { key: 'images', name: 'Images', icon: '🖼️', category: 'fun' },
  { key: 'soundboard', name: 'Soundboard', icon: '🔊', category: 'fun' },
  { key: 'raffles', name: 'Raffles', icon: '🎟️', category: 'fun' },
  { key: 'customcommands', name: 'Custom Commands', icon: '⚙️', category: 'utility' },
  { key: 'invitetracker', name: 'Invite Tracker', icon: '🔗', category: 'utility' },
  { key: 'stickymessages', name: 'Sticky Messages', icon: '📌', category: 'utility' },
  { key: 'tempvoice', name: 'Temp Voice', icon: '🔊', category: 'utility' },
  { key: 'translation', name: 'Translation', icon: '🌍', category: 'utility' },
  { key: 'statschannels', name: 'Stats Channels', icon: '📈', category: 'utility' },
  { key: 'messagetracking', name: 'Message Tracking', icon: '🔍', category: 'utility' },
  { key: 'timers', name: 'Timers', icon: '⏱️', category: 'utility' },
  { key: 'autosetup', name: 'Auto Setup', icon: '⚡', category: 'utility' },
];
