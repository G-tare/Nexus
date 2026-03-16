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
  'free', 'pro', 'plus', 'premium'
]);

export const botTicketCategory = pgEnum('bot_ticket_category', [
  'help', 'appeal', 'suggestion', 'bug', 'feedback'
]);

export const botTicketStatus = pgEnum('bot_ticket_status', [
  'open', 'claimed', 'closed'
]);

export const botTicketAuthorType = pgEnum('bot_ticket_author_type', [
  'user', 'staff'
]);

export const botStaffRole = pgEnum('bot_staff_role', [
  'support', 'manager', 'owner'
]);

export const globalToggleReason = pgEnum('global_toggle_reason', [
  'update', 'glitch', 'issue', 'misuse'
]);

export const premiumSubStatus = pgEnum('premium_sub_status', [
  'active', 'expired', 'cancelled'
]);

// ============================================
// GUILD (SERVER) CONFIGURATION
// ============================================

export const guilds = pgTable('guilds', {
  id: varchar('id', { length: 20 }).primaryKey(), // Discord guild ID
  name: varchar('name', { length: 100 }).notNull(),
  icon: varchar('icon', { length: 64 }), // Discord icon hash
  ownerId: varchar('owner_id', { length: 20 }).notNull(),
  memberCount: integer('member_count').default(0).notNull(),
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
// RAFFLES
// ============================================

export const raffles = pgTable('raffles', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  channelId: varchar('channel_id', { length: 20 }).notNull(),
  messageId: varchar('message_id', { length: 20 }),
  hostId: varchar('host_id', { length: 20 }).notNull(),
  prize: varchar('prize', { length: 256 }).notNull(),
  description: text('description'),
  winnerCount: integer('winner_count').default(1).notNull(),
  ticketPrice: integer('ticket_price').default(0).notNull(),
  currencyType: varchar('currency_type', { length: 20 }).default('coins').notNull(),
  maxTicketsPerUser: integer('max_tickets_per_user').default(10).notNull(),
  maxTotalTickets: integer('max_total_tickets'),
  isActive: boolean('is_active').default(true).notNull(),
  startsAt: timestamp('starts_at').defaultNow().notNull(),
  endsAt: timestamp('ends_at').notNull(),
  endedAt: timestamp('ended_at'),
  winners: jsonb('winners').default([]).notNull(),
});

export const raffleEntries = pgTable('raffle_entries', {
  id: serial('id').primaryKey(),
  raffleId: integer('raffle_id').notNull().references(() => raffles.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 20 }).notNull(),
  tickets: integer('tickets').default(1).notNull(),
  totalSpent: integer('total_spent').default(0).notNull(),
  enteredAt: timestamp('entered_at').defaultNow().notNull(),
}, (table) => ({
  raffleUserIdx: uniqueIndex('raffle_user_idx').on(table.raffleId, table.userId),
}));

// ============================================
// DONATIONS
// ============================================

export const donations = pgTable('donations', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  userId: varchar('user_id', { length: 20 }).notNull(),
  amount: integer('amount').notNull(),
  currencyType: varchar('currency_type', { length: 20 }).default('coins').notNull(),
  campaignName: varchar('campaign_name', { length: 100 }),
  message: text('message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  guildDonationIdx: index('guild_donation_idx').on(table.guildId, table.createdAt),
  guildUserDonationIdx: index('guild_user_donation_idx').on(table.guildId, table.userId),
}));

// ============================================
// TIMERS
// ============================================

export const timers = pgTable('timers', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  userId: varchar('user_id', { length: 20 }).notNull(),
  label: varchar('label', { length: 200 }).notNull(),
  channelId: varchar('channel_id', { length: 20 }),
  messageId: varchar('message_id', { length: 20 }),
  notifyInDm: boolean('notify_in_dm').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  startsAt: timestamp('starts_at').defaultNow().notNull(),
  endsAt: timestamp('ends_at').notNull(),
  endedAt: timestamp('ended_at'),
}, (table) => ({
  guildTimerIdx: index('guild_timer_idx').on(table.guildId, table.isActive),
  userTimerIdx: index('user_timer_idx').on(table.userId, table.isActive),
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

// ============================================
// BANKING
// ============================================

export const banks = pgTable('banks', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  userId: varchar('user_id', { length: 20 }).notNull(),
  balance: bigint('balance', { mode: 'number' }).default(0).notNull(),
  savingsBalance: bigint('savings_balance', { mode: 'number' }).default(0).notNull(),
  savingsLockedUntil: timestamp('savings_locked_until'),
  savingsInterestRate: real('savings_interest_rate').default(0).notNull(),
  savingsDepositedAt: timestamp('savings_deposited_at'),
  lastInterestPaid: timestamp('last_interest_paid'),
  depositLimit: integer('deposit_limit').default(10000).notNull(),
  dailyDeposited: integer('daily_deposited').default(0).notNull(),
  lastDepositReset: timestamp('last_deposit_reset'),
  padlockActive: boolean('padlock_active').default(false).notNull(),
  padlockExpires: timestamp('padlock_expires'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  guildUserBankIdx: uniqueIndex('guild_user_bank_idx').on(table.guildId, table.userId),
}));

// ============================================
// JOBS
// ============================================

export const jobListings = pgTable('job_listings', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  jobId: varchar('job_id', { length: 50 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  emoji: varchar('emoji', { length: 10 }),
  tier: integer('tier').default(1).notNull(),
  salary: integer('salary').notNull(),
  shiftCooldownMs: integer('shift_cooldown_ms').default(3600000).notNull(),
  shiftsPerDay: integer('shifts_per_day').default(2).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  guildJobIdx: uniqueIndex('guild_job_listing_idx').on(table.guildId, table.jobId),
}));

export const userJobs = pgTable('user_jobs', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  userId: varchar('user_id', { length: 20 }).notNull(),
  jobId: varchar('job_id', { length: 50 }).notNull(),
  tier: integer('tier').default(1).notNull(),
  salary: integer('salary').notNull(),
  hiredAt: timestamp('hired_at').defaultNow().notNull(),
  lastShift: timestamp('last_shift'),
  shiftsToday: integer('shifts_today').default(0).notNull(),
  shiftsCompleted: integer('shifts_completed').default(0).notNull(),
  totalEarned: bigint('total_earned', { mode: 'number' }).default(0).notNull(),
  warningCount: integer('warning_count').default(0).notNull(),
  lastWarning: timestamp('last_warning'),
  promotionProgress: integer('promotion_progress').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  firedAt: timestamp('fired_at'),
  fireReason: varchar('fire_reason', { length: 200 }),
}, (table) => ({
  guildUserJobIdx: uniqueIndex('guild_user_job_idx').on(table.guildId, table.userId),
}));

// ============================================
// CRIME & ROBBERY LOGS
// ============================================

export const crimeLogs = pgTable('crime_logs', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  userId: varchar('user_id', { length: 20 }).notNull(),
  actionType: varchar('action_type', { length: 30 }).notNull(),
  crimeType: varchar('crime_type', { length: 50 }),
  success: boolean('success').notNull(),
  amountGained: integer('amount_gained').default(0).notNull(),
  amountLost: integer('amount_lost').default(0).notNull(),
  targetId: varchar('target_id', { length: 20 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  guildUserCrimeIdx: index('guild_user_crime_idx').on(table.guildId, table.userId, table.createdAt),
}));

// ============================================
// CASINO
// ============================================

export const casinoHistory = pgTable('casino_history', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  userId: varchar('user_id', { length: 20 }).notNull(),
  game: varchar('game', { length: 30 }).notNull(),
  betAmount: integer('bet_amount').notNull(),
  winAmount: integer('win_amount').default(0).notNull(),
  multiplier: real('multiplier'),
  result: varchar('result', { length: 20 }).notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  guildUserCasinoIdx: index('guild_user_casino_idx').on(table.guildId, table.userId, table.createdAt),
}));

// ============================================
// FAMILY
// ============================================

export const familyRelationships = pgTable('family_relationships', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  userId: varchar('user_id', { length: 20 }).notNull(),
  partnerId: varchar('partner_id', { length: 20 }),
  parentId: varchar('parent_id', { length: 20 }),
  marriedAt: timestamp('married_at'),
  adoptedAt: timestamp('adopted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  guildUserFamilyIdx: uniqueIndex('guild_user_family_idx').on(table.guildId, table.userId),
}));

export const familyPendingRequests = pgTable('family_pending_requests', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  fromUserId: varchar('from_user_id', { length: 20 }).notNull(),
  toUserId: varchar('to_user_id', { length: 20 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  messageId: varchar('message_id', { length: 20 }),
  channelId: varchar('channel_id', { length: 20 }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// PROFILES
// ============================================

export const profiles = pgTable('profiles', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  userId: varchar('user_id', { length: 20 }).notNull(),
  aboutMe: varchar('about_me', { length: 256 }),
  age: integer('age'),
  gender: varchar('gender', { length: 50 }),
  location: varchar('location', { length: 100 }),
  status: varchar('status', { length: 128 }),
  birthday: varchar('birthday', { length: 20 }),
  profileColor: varchar('profile_color', { length: 7 }),
  bannerUrl: text('banner_url'),
  favoriteActors: jsonb('favorite_actors').default([]).notNull(),
  favoriteArtists: jsonb('favorite_artists').default([]).notNull(),
  favoriteFoods: jsonb('favorite_foods').default([]).notNull(),
  hobbies: jsonb('hobbies').default([]).notNull(),
  favoriteMovies: jsonb('favorite_movies').default([]).notNull(),
  pets: jsonb('pets').default([]).notNull(),
  favoriteSongs: jsonb('favorite_songs').default([]).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  guildUserProfileIdx: uniqueIndex('guild_user_profile_idx').on(table.guildId, table.userId),
}));

// ============================================
// SOUNDBOARD
// ============================================

export const soundboardSounds = pgTable('soundboard_sounds', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  name: varchar('name', { length: 50 }).notNull(),
  category: varchar('category', { length: 30 }).notNull(),
  url: text('url').notNull(),
  duration: integer('duration').default(0).notNull(),
  addedBy: varchar('added_by', { length: 20 }).notNull(),
  useCount: integer('use_count').default(0).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  guildSoundIdx: uniqueIndex('guild_sound_name_idx').on(table.guildId, table.name),
}));

// ============================================
// REPORTS
// ============================================

export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  reportNumber: integer('report_number').notNull(),
  reporterId: varchar('reporter_id', { length: 20 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  targetId: varchar('target_id', { length: 20 }),
  description: text('description').notNull(),
  evidence: text('evidence'),
  status: varchar('status', { length: 20 }).default('open').notNull(),
  reviewedBy: varchar('reviewed_by', { length: 20 }),
  reviewNote: text('review_note'),
  messageId: varchar('message_id', { length: 20 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  reviewedAt: timestamp('reviewed_at'),
}, (table) => ({
  guildReportIdx: index('guild_report_idx').on(table.guildId, table.reportNumber),
}));

// ============================================
// TICKET NOTICES
// ============================================

export const ticketNotices = pgTable('ticket_notices', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  ticketId: integer('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  authorId: varchar('author_id', { length: 20 }).notNull(),
  content: text('content').notNull(),
  messageId: varchar('message_id', { length: 20 }),
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

// ============================================
// BOT MANAGERS — roles & users who can access dashboard configs
// ============================================

export const botManagers = pgTable('bot_managers', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  targetType: varchar('target_type', { length: 10 }).notNull(), // 'role' | 'user'
  targetId: varchar('target_id', { length: 20 }).notNull(),     // role or user ID
  addedBy: varchar('added_by', { length: 20 }).notNull(),       // who added this manager
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  guildIdx: index('bot_managers_guild_idx').on(table.guildId),
  uniqueManager: uniqueIndex('bot_managers_unique').on(table.guildId, table.targetType, table.targetId),
}));

// ============================================
// BOT-LEVEL TICKETS (owner dashboard)
// ============================================

export const botTickets = pgTable('bot_tickets', {
  id: serial('id').primaryKey(),
  ticketNumber: serial('ticket_number'),
  guildId: varchar('guild_id', { length: 20 }),  // null for DM-created tickets
  userId: varchar('user_id', { length: 20 }).notNull(),
  username: varchar('username', { length: 100 }).notNull(),
  category: botTicketCategory('category').notNull(),
  subcategory: varchar('subcategory', { length: 100 }), // e.g. 'userphone_server_ban'
  status: botTicketStatus('status').default('open').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  claimedBy: varchar('claimed_by', { length: 20 }),
  closedBy: varchar('closed_by', { length: 20 }),
  closedReason: text('closed_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  closedAt: timestamp('closed_at'),
}, (table) => ({
  statusIdx: index('bot_ticket_status_idx').on(table.status, table.createdAt),
  categoryIdx: index('bot_ticket_category_idx').on(table.category),
  userIdx: index('bot_ticket_user_idx').on(table.userId),
}));

export const botTicketMessages = pgTable('bot_ticket_messages', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id').notNull().references(() => botTickets.id, { onDelete: 'cascade' }),
  authorType: botTicketAuthorType('author_type').notNull(),
  authorId: varchar('author_id', { length: 20 }).notNull(),
  authorName: varchar('author_name', { length: 100 }).notNull(),
  message: text('message').notNull(),
  dmMessageId: varchar('dm_message_id', { length: 20 }),  // Discord DM message ID for threading
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  ticketIdx: index('bot_ticket_msg_ticket_idx').on(table.ticketId, table.createdAt),
}));

// ============================================
// BOT STAFF (owner dashboard access control)
// ============================================

export const botStaff = pgTable('bot_staff', {
  id: serial('id').primaryKey(),
  discordId: varchar('discord_id', { length: 20 }).notNull().unique(),
  username: varchar('username', { length: 100 }).notNull(),
  avatarHash: varchar('avatar_hash', { length: 64 }),
  role: botStaffRole('role').default('support').notNull(),
  permissions: jsonb('permissions').default({}).notNull(),
  addedBy: varchar('added_by', { length: 20 }).notNull(),
  addedAt: timestamp('added_at').defaultNow().notNull(),
  removedAt: timestamp('removed_at'),
});

// ============================================
// COMMAND USAGE TRACKING
// ============================================

export const commandUsage = pgTable('command_usage', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  userId: varchar('user_id', { length: 20 }).notNull(),
  moduleName: varchar('module_name', { length: 50 }).notNull(),
  commandName: varchar('command_name', { length: 100 }).notNull(),
  subcommandName: varchar('subcommand_name', { length: 100 }),
  executionMs: integer('execution_ms'),
  success: boolean('success').default(true).notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (table) => ({
  moduleIdx: index('cmd_usage_module_idx').on(table.moduleName, table.timestamp),
  guildIdx: index('cmd_usage_guild_idx').on(table.guildId, table.timestamp),
  commandIdx: index('cmd_usage_command_idx').on(table.commandName, table.timestamp),
  timestampIdx: index('cmd_usage_timestamp_idx').on(table.timestamp),
}));

// ============================================
// GLOBAL MODULE TOGGLES (owner-level disable)
// ============================================

export const globalModuleToggles = pgTable('global_module_toggles', {
  id: serial('id').primaryKey(),
  moduleName: varchar('module_name', { length: 50 }).notNull().unique(),
  enabled: boolean('enabled').default(true).notNull(),
  reason: globalToggleReason('reason'),
  reasonDetail: text('reason_detail'),
  disabledBy: varchar('disabled_by', { length: 20 }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================
// SERVER-SPECIFIC MODULE BANS (owner-level per-server)
// ============================================

export const serverModuleBans = pgTable('server_module_bans', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  moduleName: varchar('module_name', { length: 50 }).notNull(),
  reason: varchar('reason', { length: 50 }),
  reasonDetail: text('reason_detail'),
  bannedBy: varchar('banned_by', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  guildModuleIdx: uniqueIndex('server_module_ban_idx').on(table.guildId, table.moduleName),
}));

// ============================================
// ALERT RULES & HISTORY
// ============================================

export const alertRules = pgTable('alert_rules', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  metricType: varchar('metric_type', { length: 50 }).notNull(),  // latency, errors, memory, uptime, rate_limits
  operator: varchar('operator', { length: 10 }).notNull(),        // >, <, >=, <=, =
  threshold: real('threshold').notNull(),
  webhookUrl: text('webhook_url'),
  discordChannelId: varchar('discord_channel_id', { length: 20 }),
  enabled: boolean('enabled').default(true).notNull(),
  createdBy: varchar('created_by', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const alertHistory = pgTable('alert_history', {
  id: serial('id').primaryKey(),
  ruleId: integer('rule_id').notNull().references(() => alertRules.id, { onDelete: 'cascade' }),
  triggeredAt: timestamp('triggered_at').defaultNow().notNull(),
  value: real('value').notNull(),
  message: text('message').notNull(),
  resolved: boolean('resolved').default(false).notNull(),
}, (table) => ({
  ruleIdx: index('alert_history_rule_idx').on(table.ruleId, table.triggeredAt),
}));

// ============================================
// PREMIUM SUBSCRIPTIONS (revenue tracking)
// ============================================

export const premiumSubscriptions = pgTable('premium_subscriptions', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  tier: premiumTier('tier').notNull(),
  startDate: timestamp('start_date').defaultNow().notNull(),
  expiryDate: timestamp('expiry_date'),
  amount: real('amount').default(0).notNull(),
  status: premiumSubStatus('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  guildIdx: index('premium_sub_guild_idx').on(table.guildId),
  statusIdx: index('premium_sub_status_idx').on(table.status),
}));

// ============================================
// USER BLOCKLIST (bot-wide user blocks)
// ============================================

export const userBlocklist = pgTable('user_blocklist', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 20 }).notNull().unique(),
  reason: text('reason').notNull(),
  blockedBy: varchar('blocked_by', { length: 20 }).notNull(),
  blockedAt: timestamp('blocked_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
});

// ============================================
// USERPHONE USER-LEVEL BANS
// ============================================

export const userphoneUserBans = pgTable('userphone_user_bans', {
  userId: varchar('user_id', { length: 20 }).primaryKey(),
  reason: text('reason').notNull(),
  bannedBy: varchar('banned_by', { length: 20 }).notNull(),
  bannedAt: timestamp('banned_at').defaultNow().notNull(),
});

// ============================================
// BOT ANNOUNCEMENTS (owner broadcasts)
// ============================================

export const botAnnouncements = pgTable('bot_announcements', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  message: text('message').notNull(),
  type: varchar('type', { length: 20 }).default('info').notNull(),
  authorId: varchar('author_id', { length: 20 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// TEMP BANS (for timer-based expiry, replaces Redis TTL keys)
// ============================================

export const tempBans = pgTable('temp_bans', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 20 }).notNull(),
  userId: varchar('user_id', { length: 20 }).notNull(),
  moderatorId: varchar('moderator_id', { length: 20 }).notNull(),
  reason: text('reason'),
  caseNumber: integer('case_number'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

