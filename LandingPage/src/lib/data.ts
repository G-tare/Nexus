// ============================================
// Module data for the landing page
// ============================================

export interface Module {
  name: string;
  description: string;
  icon: string;
  category: string;
  commandCount: number;
}

export const MODULES: Module[] = [
  { name: "Moderation", description: "Ban, kick, mute, warn, purge, lockdown, case management & more", icon: "\u{1F6E1}", category: "moderation", commandCount: 45 },
  { name: "Auto Mod", description: "Anti-spam, anti-raid, word filters, link blocking, anti-nuke", icon: "\u{1F916}", category: "moderation", commandCount: 12 },
  { name: "Anti-Raid", description: "Automatic raid detection, lockdown, mass-join protection", icon: "\u26A0\uFE0F", category: "moderation", commandCount: 4 },
  { name: "Logging", description: "Message edits, deletes, joins, leaves, role changes & more", icon: "\u{1F4DD}", category: "moderation", commandCount: 5 },
  { name: "Leveling", description: "XP system, level roles, leaderboards, double XP events", icon: "\u2B50", category: "engagement", commandCount: 13 },
  { name: "Leaderboards", description: "Global and server leaderboards across all systems", icon: "\u{1F3C6}", category: "engagement", commandCount: 3 },
  { name: "Activity Tracking", description: "Track voice & message activity, see who's most active", icon: "\u{1F4CA}", category: "engagement", commandCount: 4 },
  { name: "Reputation", description: "Rep system, give/remove rep, reputation leaderboards", icon: "\u{1F31F}", category: "engagement", commandCount: 8 },
  { name: "Fun", description: "Trivia, games, social actions, memes, jokes, 8ball & more", icon: "\u{1F3AE}", category: "fun", commandCount: 36 },
  { name: "Music", description: "Play, queue, filters, playlists, lyrics, DJ controls", icon: "\u{1F3B5}", category: "fun", commandCount: 27 },
  { name: "Polls", description: "Create polls with reactions, timed polls, poll results", icon: "\u{1F4CA}", category: "fun", commandCount: 5 },
  { name: "Userphone", description: "Anonymous cross-server calling and messaging", icon: "\u{1F4DE}", category: "fun", commandCount: 4 },
  { name: "Voice Phone", description: "Cross-server voice calling with real-time audio relay", icon: "\u{1F4F1}", category: "social", commandCount: 2 },
  { name: "Currency", description: "Economy system, daily/work rewards, gambling, transfers", icon: "\u{1F4B0}", category: "economy", commandCount: 12 },
  { name: "Shop", description: "Create custom shops, buy/sell items, inventory management", icon: "\u{1F6D2}", category: "economy", commandCount: 8 },
  { name: "Giveaways", description: "Timed giveaways, requirements, rerolls, multiple winners", icon: "\u{1F381}", category: "utility", commandCount: 13 },
  { name: "Tickets", description: "Support tickets, panels, categories, transcripts, auto-close", icon: "\u{1F3AB}", category: "utility", commandCount: 18 },
  { name: "Forms", description: "Custom application forms, staff review, approval workflow", icon: "\u{1F4CB}", category: "utility", commandCount: 8 },
  { name: "Suggestions", description: "Suggestion box, staff approval, status tracking", icon: "\u{1F4A1}", category: "utility", commandCount: 7 },
  { name: "Reminders", description: "Personal and server reminders, recurring reminders", icon: "\u23F0", category: "utility", commandCount: 5 },
  { name: "Scheduled Messages", description: "Schedule messages for future delivery, recurring posts", icon: "\u{1F4C5}", category: "utility", commandCount: 5 },
  { name: "Welcome", description: "Custom welcome/leave messages, autorole, DM greetings", icon: "\u{1F44B}", category: "utility", commandCount: 10 },
  { name: "Auto Roles", description: "Assign roles on join, by reaction, by level, delayed", icon: "\u{1F3AD}", category: "utility", commandCount: 7 },
  { name: "Reaction Roles", description: "Reaction-based role assignment with custom panels", icon: "\u{1F3AF}", category: "utility", commandCount: 6 },
  { name: "Color Roles", description: "Custom color roles, color picker, presets, hex codes", icon: "\u{1F308}", category: "utility", commandCount: 25 },
  { name: "Backup", description: "Full server backup and restore, scheduled backups", icon: "\u{1F4BE}", category: "utility", commandCount: 7 },
  { name: "Confessions", description: "Anonymous confessions, staff moderation, blacklist", icon: "\u{1F5E3}\uFE0F", category: "social", commandCount: 6 },
  { name: "Quote Board", description: "Starboard-style quote system, reaction threshold", icon: "\u2728", category: "social", commandCount: 3 },
  { name: "Birthdays", description: "Birthday tracker, announcements, birthday roles", icon: "\u{1F382}", category: "social", commandCount: 7 },
  { name: "AFK", description: "AFK status with auto-response when mentioned", icon: "\u{1F4A4}", category: "social", commandCount: 5 },
  { name: "AI Chatbot", description: "AI-powered conversation, per-channel setup, context memory", icon: "\u{1F9E0}", category: "social", commandCount: 5 },
  { name: "Custom Commands", description: "Create custom commands with variables and embeds", icon: "\u2699\uFE0F", category: "utility", commandCount: 6 },
  { name: "Invite Tracker", description: "Track who invited whom, invite leaderboard, fake detection", icon: "\u{1F517}", category: "utility", commandCount: 6 },
  { name: "Counting", description: "Counting channels with saves, math mode, milestones", icon: "\u{1F522}", category: "fun", commandCount: 4 },
  { name: "Sticky Messages", description: "Pin messages that stay at the bottom of a channel", icon: "\u{1F4CC}", category: "utility", commandCount: 4 },
  { name: "Temp Voice", description: "Temporary voice channels, custom names, limits, permissions", icon: "\u{1F50A}", category: "utility", commandCount: 11 },
  { name: "Translation", description: "Real-time message translation, auto-translate channels", icon: "\u{1F30D}", category: "utility", commandCount: 6 },
  { name: "Stats Channels", description: "Auto-updating stat channels for members, roles, etc.", icon: "\u{1F4C8}", category: "utility", commandCount: 5 },
  { name: "Message Tracking", description: "Snipe deleted/edited messages, message history", icon: "\u{1F50D}", category: "utility", commandCount: 3 },
];

export const CATEGORIES = [
  { id: "all", label: "All Modules", count: 39 },
  { id: "moderation", label: "Moderation", count: 4 },
  { id: "engagement", label: "Engagement", count: 4 },
  { id: "fun", label: "Fun & Games", count: 4 },
  { id: "economy", label: "Economy", count: 2 },
  { id: "utility", label: "Utility", count: 16 },
  { id: "social", label: "Social", count: 5 },
];

export const STATS = [
  { label: "Modules", value: 39, suffix: "" },
  { label: "Commands", value: 370, suffix: "+" },
  { label: "Features", value: 150, suffix: "+" },
  { label: "Uptime", value: 99.9, suffix: "%" },
];

// Feature showcase data — the big interactive sections
export interface Feature {
  title: string;
  subtitle: string;
  description: string;
  highlights: string[];
  color: string;
  demoType: "moderation" | "leveling" | "music" | "economy" | "tickets";
}

export const FEATURES: Feature[] = [
  {
    title: "Moderation",
    subtitle: "Complete Server Control",
    description: "Everything you need to keep your server safe. From basic bans to advanced anti-raid with automatic detection.",
    highlights: ["Auto-mod with AI detection", "45+ moderation commands", "Case management system", "Anti-raid protection"],
    color: "#ef4444",
    demoType: "moderation",
  },
  {
    title: "Leveling & XP",
    subtitle: "Keep Members Engaged",
    description: "A full XP system with voice and message tracking, level roles, custom rank cards, and double XP events.",
    highlights: ["Message & voice XP", "Custom rank cards", "Level-up roles", "Double XP events"],
    color: "#f59e0b",
    demoType: "leveling",
  },
  {
    title: "Music",
    subtitle: "High Quality Audio",
    description: "Play from YouTube, Spotify, SoundCloud and more. Full queue management, filters, playlists, and DJ controls.",
    highlights: ["Multi-platform support", "Audio filters & effects", "Server playlists", "DJ role controls"],
    color: "#8b5cf6",
    demoType: "music",
  },
  {
    title: "Economy",
    subtitle: "Virtual Economy System",
    description: "A complete economy with daily rewards, work commands, gambling, custom shops, and item trading.",
    highlights: ["Currency system", "Custom shop items", "Gambling games", "Trading & transfers"],
    color: "#10b981",
    demoType: "economy",
  },
  {
    title: "Tickets",
    subtitle: "Professional Support",
    description: "Full-featured ticket system with panels, categories, claiming, priorities, transcripts, and auto-close.",
    highlights: ["Custom ticket panels", "Category routing", "HTML transcripts", "Auto-close inactive"],
    color: "#3b82f6",
    demoType: "tickets",
  },
];

// Demo chat messages for the interactive command demo
export interface DemoMessage {
  author: string;
  avatar: string;
  content: string;
  isCommand?: boolean;
  isBot?: boolean;
  isButton?: boolean;
  embed?: {
    title: string;
    fields: { name: string; value: string }[];
    color: string;
  };
}

export interface DemoConversation {
  id: string;
  messages: DemoMessage[];
}

export const DEMO_CONVERSATIONS: DemoConversation[] = [
  {
    id: "moderation",
    messages: [
      { author: "Admin", avatar: "#ef4444", content: "/mod ban @ToxicUser reason: Repeated harassment", isCommand: true },
      { author: "Nexus Bot", avatar: "#00d4ff", content: "", isBot: true, embed: {
        title: "\u{1F6E1}\uFE0F User Banned",
        fields: [
          { name: "User", value: "ToxicUser#0001" },
          { name: "Reason", value: "Repeated harassment" },
          { name: "Case", value: "#1247" },
        ],
        color: "#ef4444",
      }},
    ],
  },
  {
    id: "leveling",
    messages: [
      { author: "Member", avatar: "#f59e0b", content: "/leveling rank", isCommand: true },
      { author: "Nexus Bot", avatar: "#00d4ff", content: "", isBot: true, embed: {
        title: "\u2B50 Level 24",
        fields: [
          { name: "XP", value: "12,450 / 15,000" },
          { name: "Rank", value: "#3 on server" },
          { name: "Next Role", value: "Elite Member at Lv. 25" },
        ],
        color: "#f59e0b",
      }},
    ],
  },
  {
    id: "music",
    messages: [
      { author: "DJ", avatar: "#8b5cf6", content: "/music play query: lofi hip hop radio", isCommand: true },
      { author: "Nexus Bot", avatar: "#00d4ff", content: "", isBot: true, embed: {
        title: "\u{1F3B5} Now Playing",
        fields: [
          { name: "Track", value: "lofi hip hop radio - beats to relax/study to" },
          { name: "Duration", value: "LIVE" },
          { name: "Requested by", value: "DJ" },
        ],
        color: "#8b5cf6",
      }},
    ],
  },
  {
    id: "economy",
    messages: [
      { author: "Player", avatar: "#10b981", content: "/currency daily", isCommand: true },
      { author: "Nexus Bot", avatar: "#00d4ff", content: "", isBot: true, embed: {
        title: "\u{1F4B0} Daily Reward Claimed!",
        fields: [
          { name: "Earned", value: "+500 coins" },
          { name: "Streak", value: "7 days (\u{1F525} x1.5 bonus!)" },
          { name: "Balance", value: "12,750 coins" },
        ],
        color: "#10b981",
      }},
    ],
  },
  {
    id: "tickets",
    messages: [
      { author: "User", avatar: "#3b82f6", content: "Clicked: \u{1F3AB} Open Support Ticket", isCommand: false, isButton: true },
      { author: "Nexus Bot", avatar: "#00d4ff", content: "", isBot: true, embed: {
        title: "\u{1F3AB} Ticket Created",
        fields: [
          { name: "Channel", value: "#ticket-0482" },
          { name: "Category", value: "General Support" },
          { name: "Status", value: "Waiting for staff" },
        ],
        color: "#3b82f6",
      }},
    ],
  },
];
