import {
  pgTable, varchar, text, integer, bigint, boolean,
  timestamp, jsonb, serial, uniqueIndex, index, real,
  pgEnum
} from 'drizzle-orm/pg-core';

// ============================================
// ENUMS
// ============================================

export const modActionType = pgEnum('mod_action_type', [
  'warn', 'mute', 'unmute', 'kick', 'ban', 'unban', 'tempban', 'softban', 'note'
]);

export const automodActionType = pgEnum('automod_action_type', [
  'delete', 'warn', 'mute', 'kick', 'ban'
]);

export const ticketStatus = pgEnum('ticket_status', [
  'open', 'claimed', 'closed'
]);

export const ticketPriority = pgEnum('ticket_priority', [
  'low', 'medium', 'high', 'urgent'
]);

export const suggestionStatus = pgEnum('suggestion_status', [
  'pending', 'approved', 'denied', 'considering', 'implemented'
]);

export const premiumTier = pgEnum('premium_tier', [
  'free', 'premium', 'ultimate'
]);

// ============================================
// GUILD (SERVER) CONFIGURATION
// ============================================

export const guilds = pgTable('guilds', {
  id: varchar('id', { length: 20 }).primaryKey(), // Discord guild ID
  name: varchar('name', { length: 100 }).notNull(),
  ownerId: varchar('owner_id', { length: 20 }).notNull(),
  premiumTier: premiumTier('premium_tier').default('free').notNull(),
  premiumExpiresAt: timestamp('premium_expires_at'),
  locale: varchar('locale', { length: 10 }).default('en').notNull(),
  timezone: varchar('timezone', { length: 50 }).default('UTC').notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  leftAt: timestamp('left_at'),
  isActive: boolean('is_active').default(true).notNull(),
});

// Module-specific configs stored as JSONB for flexibility
export const guildModuleConfigs = pgTable('guild_module_configs', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  module: varchar('module', { length: 50 }).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  config: jsonb('config').default({}).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  guildModuleIdx: uniqueIndex('guild_module_idx').on(table.guildId, table.module),
}));

// ============================================
// PERMISSIONS
// ============================================

export const commandPermissions = pgTable('command_permissions', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  command: varchar('command', { length: 100 }).notNull(),   // e.g., "moderation.ban"
  targetType: varchar('target_type', { length: 10 }).notNull(), // 'role' | 'user' | 'channel'
  targetId: varchar('target_id', { length: 20 }).notNull(),     // role/user/channel ID
  allowed: boolean('allowed').notNull(),  // true = allow, false = deny
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  guildCommandIdx: index('guild_command_idx').on(table.guildId, table.command),
  guildTargetIdx: index('guild_target_idx').on(table.guildId, table.targetId),
}));

// ============================================
// USERS (global user data)
// ============================================

export const users = pgTable('users', {
  id: varchar('id', { length: 20 }).primaryKey(), // Discord user ID
  username: varchar('username', { length: 100 }),
  globalName: varchar('global_name', { length: 100 }),
  avatarUrl: text('avatar_url'),
  locale: varchar('locale', { length: 10 }).default('en'),
  timezone: varchar('timezone', { length: 50 }),
  birthday: varchar('birthday', { length: 5 }), // MM-DD format
  birthdayYear: integer('birthday_year'), // optional year
  afkMessage: text('afk_message'),
  afkSince: timestamp('afk_since'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// GUILD MEMBERS (per-server user data)
// ============================================

export const guildMembers = pgTable('guild_members', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 20 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Leveling
  xp: integer('xp').default(0).notNull(),
  level: integer('level').default(0).notNull(),
  totalXp: bigint('total_xp', { mode: 'number' }).default(0).notNull(),
  prestige: integer('prestige').default(0).notNull(),
  // Currency
  coins: bigint('coins', { mode: 'number' }).default(0).notNull(),
  gems: bigint('gems', { mode: 'number' }).default(0).notNull(),
  eventTokens: bigint('event_tokens', { mode: 'number' }).default(0).notNull(),
  // Activity
  totalMessages: bigint('total_messages', { mode: 'number' }).default(0).notNull(),
  totalVoiceMinutes: bigint('total_voice_minutes', { mode: 'number' }).default(0).notNull(),
  lastMessageAt: timestamp('last_message_at'),
  lastVoiceAt: timestamp('last_voice_at'),
  dailyMessages: integer('daily_messages').default(0).notNull(),
  // Streaks
  dailyStreak: integer('daily_streak').default(0).notNull(),
  lastDailyClaim: timestamp('last_daily_claim'),
  lastWeeklyClaim: timestamp('last_weekly_claim'),
  // Invites
  inviteCount: integer('invite_count').default(0).notNull(),
  inviteFakeCount: integer('invite_fake_count').default(0).notNull(),
  inviteLeaveCount: integer('invite_leave_count').default(0).notNull(),
  invitedBy: varchar('invited_by', { length: 20 }),
  // Reputation
  reputation: integer('reputation').default(80).notNull(),
  lastRepGiven: timestamp('last_rep_given'),
  // Moderation
  warnCount: integer('warn_count').default(0).notNull(),
  isMuted: boolean('is_muted').default(false).notNull(),
  muteExpiresAt: timestamp('mute_expires_at'),
  // Misc
  colorRoleId: varchar('color_role_id', { length: 20 }),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  lastActiveAt: timestamp('last_active_at').defaultNow().notNull(),
}, (table) => ({
  guildUserIdx: uniqueIndex('guild_user_idx').on(table.guildId, table.userId),
  guildXpIdx: index('guild_xp_idx').on(table.guildId, table.totalXp),
  guildCoinsIdx: index('guild_coins_idx').on(table.guildId, table.coins),
  guildMessagesIdx: index('guild_messages_idx').on(table.guildId, table.totalMessages),
  guildLevelIdx: index('guild_level_idx').on(table.guildId, table.level),
}));

// ============================================
// MODERATION
// ============================================

export const modCases = pgTable('mod_cases', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  caseNumber: integer('case_number').notNull(),
  action: modActionType('action').notNull(),
  targetId: varchar('target_id', { length: 20 }).notNull(),
  moderatorId: varchar('moderator_id', { length: 20 }).notNull(),
  reason: text('reason'),
  duration: integer('duration'), // in seconds, for timed actions
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  guildCaseIdx: uniqueIndex('guild_case_idx').on(table.guildId, table.caseNumber),
  guildTargetIdx: index('mod_guild_target_idx').on(table.guildId, table.targetId),
}));

// ============================================
// AUTOMOD LOGS
// ============================================

export const automodLogs = pgTable('automod_logs', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  targetId: varchar('target_id', { length: 20 }).notNull(),
  action: automodActionType('action').notNull(),
  violationType: varchar('violation_type', { length: 50 }).notNull(),
  reason: text('reason'),
  messageContent: text('message_content'),
  channelId: varchar('channel_id', { length: 20 }),
  duration: integer('duration'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  guildIdx: index('automod_guild_idx').on(table.guildId, table.createdAt),
  guildTargetIdx: index('automod_guild_target_idx').on(table.guildId, table.targetId),
}));

// ============================================
// ECONOMY
// ============================================

export const shopItems = pgTable('shop_items', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  price: integer('price').notNull(),
  currencyType: varchar('currency_type', { length: 20 }).default('coins').notNull(),
  itemType: varchar('item_type', { length: 30 }).notNull(), // role, color, xp_boost, etc.
  itemData: jsonb('item_data').default({}).notNull(), // type-specific data (roleId, duration, multiplier, etc.)
  stock: integer('stock'), // null = unlimited
  requiredRoleId: varchar('required_role_id', { length: 20 }),
  requiredLevel: integer('required_level'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userInventory = pgTable('user_inventory', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  userId: varchar('user_id', { length: 20 }).notNull(),
  itemId: integer('item_id').notNull().references(() => shopItems.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').default(1).notNull(),
  purchasedAt: timestamp('purchased_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'), // for timed items
}, (table) => ({
  guildUserItemIdx: index('guild_user_item_idx').on(table.guildId, table.userId, table.itemId),
}));

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  userId: varchar('user_id', { length: 20 }).notNull(),
  type: varchar('type', { length: 30 }).notNull(), // earn, spend, transfer_in, transfer_out, admin_give, admin_take
  currencyType: varchar('currency_type', { length: 20 }).notNull(),
  amount: integer('amount').notNull(), // positive for gains, negative for losses
  balance: bigint('balance', { mode: 'number' }).notNull(), // balance after transaction
  source: varchar('source', { length: 50 }).notNull(), // daily, message, game_win, shop_purchase, etc.
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  guildUserTxIdx: index('guild_user_tx_idx').on(table.guildId, table.userId, table.createdAt),
}));

// ============================================
// GIVEAWAYS
// ============================================

export const giveaways = pgTable('giveaways', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  channelId: varchar('channel_id', { length: 20 }).notNull(),
  messageId: varchar('message_id', { length: 20 }),
  hostId: varchar('host_id', { length: 20 }).notNull(),
  prize: varchar('prize', { length: 256 }).notNull(),
  winnerCount: integer('winner_count').default(1).notNull(),
  requirements: jsonb('requirements').default({}).notNull(),
  winners: jsonb('winners').default([]).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  startsAt: timestamp('starts_at').defaultNow().notNull(),
  endsAt: timestamp('ends_at').notNull(),
  endedAt: timestamp('ended_at'),
});

export const giveawayEntries = pgTable('giveaway_entries', {
  id: serial('id').primaryKey(),
  giveawayId: integer('giveaway_id').notNull().references(() => giveaways.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 20 }).notNull(),
  entries: integer('entries').default(1).notNull(), // bonus entries
  enteredAt: timestamp('entered_at').defaultNow().notNull(),
}, (table) => ({
  giveawayUserIdx: uniqueIndex('giveaway_user_idx').on(table.giveawayId, table.userId),
}));

// ============================================
// TICKETS
// ============================================

export const tickets = pgTable('tickets', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  ticketNumber: integer('ticket_number').notNull(),
  channelId: varchar('channel_id', { length: 20 }),
  userId: varchar('user_id', { length: 20 }).notNull(),
  categoryName: varchar('category_name', { length: 50 }),
  status: ticketStatus('status').default('open').notNull(),
  priority: ticketPriority('priority').default('medium').notNull(),
  claimedBy: varchar('claimed_by', { length: 20 }),
  transcript: text('transcript'),
  formResponses: jsonb('form_responses'),
  closedBy: varchar('closed_by', { length: 20 }),
  closeReason: text('close_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  closedAt: timestamp('closed_at'),
}, (table) => ({
  guildTicketIdx: uniqueIndex('guild_ticket_idx').on(table.guildId, table.ticketNumber),
}));

// ============================================
// CONFESSIONS
// ============================================

export const confessions = pgTable('confessions', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  confessionNumber: integer('confession_number').notNull(),
  userId: varchar('user_id', { length: 20 }).notNull(), // stored but only shown to staff if logging enabled
  content: text('content').notNull(),
  imageUrl: text('image_url'),
  messageId: varchar('message_id', { length: 20 }),
  isApproved: boolean('is_approved'),
  isReported: boolean('is_reported').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// SUGGESTIONS
// ============================================

export const suggestions = pgTable('suggestions', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  suggestionNumber: integer('suggestion_number').notNull(),
  userId: varchar('user_id', { length: 20 }).notNull(),
  content: text('content').notNull(),
  status: suggestionStatus('status').default('pending').notNull(),
  staffResponse: text('staff_response'),
  staffResponderId: varchar('staff_responder_id', { length: 20 }),
  messageId: varchar('message_id', { length: 20 }),
  upvotes: integer('upvotes').default(0).notNull(),
  downvotes: integer('downvotes').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  respondedAt: timestamp('responded_at'),
});

// ============================================
// REMINDERS
// ============================================

export const reminders = pgTable('reminders', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 20 }).notNull(),
  guildId: varchar('guild_id', { length: 20 }),
  channelId: varchar('channel_id', { length: 20 }),
  message: text('message').notNull(),
  remindAt: timestamp('remind_at').notNull(),
  isRecurring: boolean('is_recurring').default(false).notNull(),
  recurringInterval: integer('recurring_interval'), // in seconds
  isDm: boolean('is_dm').default(true).notNull(),
  isSent: boolean('is_sent').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// REACTION ROLES
// ============================================

export const reactionRoles = pgTable('reaction_roles', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  channelId: varchar('channel_id', { length: 20 }).notNull(),
  messageId: varchar('message_id', { length: 20 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // reaction, button, dropdown
  mode: varchar('mode', { length: 20 }).default('normal').notNull(), // normal, unique, addonly, removeonly
  roles: jsonb('roles').default([]).notNull(), // [{emoji/label, roleId, description}]
  requiredRoleId: varchar('required_role_id', { length: 20 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// STAR / SKULL / QUOTE BOARDS
// ============================================

export const boardMessages = pgTable('board_messages', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  boardType: varchar('board_type', { length: 20 }).notNull(), // star, skull, quote
  sourceChannelId: varchar('source_channel_id', { length: 20 }).notNull(),
  sourceMessageId: varchar('source_message_id', { length: 20 }).notNull(),
  boardMessageId: varchar('board_message_id', { length: 20 }),
  authorId: varchar('author_id', { length: 20 }).notNull(),
  reactionCount: integer('reaction_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  sourceIdx: uniqueIndex('board_source_idx').on(table.guildId, table.boardType, table.sourceMessageId),
}));

// ============================================
// FORMS
// ============================================

export const forms = pgTable('forms', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  questions: jsonb('questions').default([]).notNull(),
  responseChannelId: varchar('response_channel_id', { length: 20 }),
  maxResponses: integer('max_responses'),
  onePerUser: boolean('one_per_user').default(false).notNull(),
  dmConfirm: boolean('dm_confirm').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const formResponses = pgTable('form_responses', {
  id: serial('id').primaryKey(),
  formId: integer('form_id').notNull().references(() => forms.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 20 }).notNull(),
  answers: jsonb('answers').default([]).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// COUNTING
// ============================================

export const countingState = pgTable('counting_state', {
  guildId: varchar('guild_id', { length: 20 }).primaryKey(),
  channelId: varchar('channel_id', { length: 20 }),
  currentCount: integer('current_count').default(0).notNull(),
  highestCount: integer('highest_count').default(0).notNull(),
  lastCounterId: varchar('last_counter_id', { length: 20 }),
  totalCounts: bigint('total_counts', { mode: 'number' }).default(0).notNull(),
});

// ============================================
// SCHEDULED MESSAGES
// ============================================

export const scheduledMessages = pgTable('scheduled_messages', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  channelId: varchar('channel_id', { length: 20 }).notNull(),
  creatorId: varchar('creator_id', { length: 20 }).notNull(),
  content: text('content'),
  embedData: jsonb('embed_data'),
  scheduledFor: timestamp('scheduled_for'),
  cronExpression: varchar('cron_expression', { length: 100 }),
  isRecurring: boolean('is_recurring').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  lastSentAt: timestamp('last_sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// CUSTOM COMMANDS
// ============================================

export const customCommands = pgTable('custom_commands', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  name: varchar('name', { length: 50 }).notNull(),
  aliases: jsonb('aliases').default([]).notNull(),
  response: text('response').notNull(),
  embedResponse: boolean('embed_response').default(false).notNull(),
  requiredRoleId: varchar('required_role_id', { length: 20 }),
  cooldown: integer('cooldown').default(0).notNull(), // seconds
  useCount: integer('use_count').default(0).notNull(),
  createdBy: varchar('created_by', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  guildNameIdx: uniqueIndex('custom_cmd_guild_name_idx').on(table.guildId, table.name),
}));

// ============================================
// SERVER BACKUPS
// ============================================

export const serverBackups = pgTable('server_backups', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  data: jsonb('data').notNull(), // full config snapshot
  createdBy: varchar('created_by', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// STICKY MESSAGES
// ============================================

export const stickyMessages = pgTable('sticky_messages', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  channelId: varchar('channel_id', { length: 20 }).notNull(),
  content: text('content'),
  embedData: jsonb('embed_data'),
  currentMessageId: varchar('current_message_id', { length: 20 }),
  interval: integer('interval').default(5).notNull(), // re-post after X messages
  messagesSince: integer('messages_since').default(0).notNull(),
  priority: integer('priority').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});

// ============================================
// ACTIVITY TRACKING (hourly aggregation)
// ============================================

export const activityHourly = pgTable('activity_hourly', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  userId: varchar('user_id', { length: 20 }).notNull(),
  hour: timestamp('hour').notNull(), // truncated to hour
  messages: integer('messages').default(0).notNull(),
  voiceMinutes: integer('voice_minutes').default(0).notNull(),
  reactions: integer('reactions').default(0).notNull(),
  commands: integer('commands').default(0).notNull(),
}, (table) => ({
  guildUserHourIdx: uniqueIndex('activity_guild_user_hour_idx').on(table.guildId, table.userId, table.hour),
  guildHourIdx: index('activity_guild_hour_idx').on(table.guildId, table.hour),
}));

// ============================================
// MUSIC PLAYLISTS
// ============================================

export const playlists = pgTable('playlists', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 20 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  tracks: jsonb('tracks').default([]).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userNameIdx: uniqueIndex('playlist_user_name_idx').on(table.userId, table.name),
}));

// ============================================
// POLLS
// ============================================

export const polls = pgTable('polls', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  channelId: varchar('channel_id', { length: 20 }).notNull(),
  messageId: varchar('message_id', { length: 20 }),
  creatorId: varchar('creator_id', { length: 20 }).notNull(),
  question: text('question').notNull(),
  options: jsonb('options').default([]).notNull(),
  votes: jsonb('votes').default({}).notNull(),
  isAnonymous: boolean('is_anonymous').default(false).notNull(),
  maxChoices: integer('max_choices').default(1).notNull(),
  showLiveResults: boolean('show_live_results').default(true).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  endsAt: timestamp('ends_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// TEMP VOICE CHANNELS
// ============================================

export const tempVoiceChannels = pgTable('temp_voice_channels', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  channelId: varchar('channel_id', { length: 20 }).notNull(),
  ownerId: varchar('owner_id', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// STATS CHANNELS
// ============================================

export const statsChannels = pgTable('stats_channels', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  channelId: varchar('channel_id', { length: 20 }).notNull(),
  type: varchar('type', { length: 30 }).notNull(),
  format: varchar('format', { length: 100 }).notNull(),
  customValue: integer('custom_value'),
  lastUpdated: timestamp('last_updated'),
});
