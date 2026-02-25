import { getPool } from './connection';
import { createModuleLogger } from '../utils/logger';
import { config } from '../config';

const logger = createModuleLogger('Migrations');

/**
 * Run all database migrations.
 * Creates tables if they don't exist.
 */
async function migrate() {
  logger.info('Running database migrations...');
  const pool = getPool();

  try {
    await pool.query(`
      -- ============================================
      -- ENUMS
      -- ============================================
      DO $$ BEGIN
        CREATE TYPE mod_action_type AS ENUM ('warn', 'mute', 'unmute', 'kick', 'ban', 'unban', 'tempban', 'softban', 'note');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE ticket_status AS ENUM ('open', 'claimed', 'closed');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE suggestion_status AS ENUM ('pending', 'approved', 'denied', 'considering', 'implemented');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE premium_tier AS ENUM ('free', 'premium', 'ultimate');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      -- ============================================
      -- GUILDS
      -- ============================================
      CREATE TABLE IF NOT EXISTS guilds (
        id VARCHAR(20) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        owner_id VARCHAR(20) NOT NULL,
        premium_tier premium_tier NOT NULL DEFAULT 'free',
        premium_expires_at TIMESTAMP,
        locale VARCHAR(10) NOT NULL DEFAULT 'en',
        timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
        joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
        left_at TIMESTAMP,
        is_active BOOLEAN NOT NULL DEFAULT true
      );

      -- ============================================
      -- GUILD MODULE CONFIGS
      -- ============================================
      CREATE TABLE IF NOT EXISTS guild_module_configs (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
        module VARCHAR(50) NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT false,
        config JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS guild_module_idx ON guild_module_configs(guild_id, module);

      -- ============================================
      -- COMMAND PERMISSIONS
      -- ============================================
      CREATE TABLE IF NOT EXISTS command_permissions (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
        command VARCHAR(100) NOT NULL,
        target_type VARCHAR(10) NOT NULL,
        target_id VARCHAR(20) NOT NULL,
        allowed BOOLEAN NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS guild_command_idx ON command_permissions(guild_id, command);
      CREATE INDEX IF NOT EXISTS guild_target_idx ON command_permissions(guild_id, target_id);

      -- ============================================
      -- USERS
      -- ============================================
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(20) PRIMARY KEY,
        username VARCHAR(100),
        global_name VARCHAR(100),
        avatar_url TEXT,
        locale VARCHAR(10) DEFAULT 'en',
        timezone VARCHAR(50),
        birthday VARCHAR(5),
        birthday_year INTEGER,
        afk_message TEXT,
        afk_since TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- ============================================
      -- GUILD MEMBERS
      -- ============================================
      CREATE TABLE IF NOT EXISTS guild_members (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
        user_id VARCHAR(20) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        xp INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 0,
        total_xp BIGINT NOT NULL DEFAULT 0,
        prestige INTEGER NOT NULL DEFAULT 0,
        coins BIGINT NOT NULL DEFAULT 0,
        gems BIGINT NOT NULL DEFAULT 0,
        event_tokens BIGINT NOT NULL DEFAULT 0,
        total_messages BIGINT NOT NULL DEFAULT 0,
        total_voice_minutes BIGINT NOT NULL DEFAULT 0,
        last_message_at TIMESTAMP,
        last_voice_at TIMESTAMP,
        daily_messages INTEGER NOT NULL DEFAULT 0,
        daily_streak INTEGER NOT NULL DEFAULT 0,
        last_daily_claim TIMESTAMP,
        last_weekly_claim TIMESTAMP,
        invite_count INTEGER NOT NULL DEFAULT 0,
        invite_fake_count INTEGER NOT NULL DEFAULT 0,
        invite_leave_count INTEGER NOT NULL DEFAULT 0,
        invited_by VARCHAR(20),
        reputation INTEGER NOT NULL DEFAULT 80,
        last_rep_given TIMESTAMP,
        warn_count INTEGER NOT NULL DEFAULT 0,
        is_muted BOOLEAN NOT NULL DEFAULT false,
        mute_expires_at TIMESTAMP,
        color_role_id VARCHAR(20),
        joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_active_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS guild_user_idx ON guild_members(guild_id, user_id);
      CREATE INDEX IF NOT EXISTS guild_xp_idx ON guild_members(guild_id, total_xp);
      CREATE INDEX IF NOT EXISTS guild_coins_idx ON guild_members(guild_id, coins);
      CREATE INDEX IF NOT EXISTS guild_messages_idx ON guild_members(guild_id, total_messages);
      CREATE INDEX IF NOT EXISTS guild_level_idx ON guild_members(guild_id, level);

      -- ============================================
      -- MOD CASES
      -- ============================================
      CREATE TABLE IF NOT EXISTS mod_cases (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
        case_number INTEGER NOT NULL,
        action mod_action_type NOT NULL,
        target_id VARCHAR(20) NOT NULL,
        moderator_id VARCHAR(20) NOT NULL,
        reason TEXT,
        duration INTEGER,
        expires_at TIMESTAMP,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS guild_case_idx ON mod_cases(guild_id, case_number);
      CREATE INDEX IF NOT EXISTS mod_guild_target_idx ON mod_cases(guild_id, target_id);

      -- ============================================
      -- SHOP & ECONOMY
      -- ============================================
      CREATE TABLE IF NOT EXISTS shop_items (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        price INTEGER NOT NULL,
        currency_type VARCHAR(20) NOT NULL DEFAULT 'coins',
        item_type VARCHAR(30) NOT NULL,
        item_data JSONB NOT NULL DEFAULT '{}',
        stock INTEGER,
        required_role_id VARCHAR(20),
        required_level INTEGER,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_inventory (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        item_id INTEGER NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1,
        purchased_at TIMESTAMP NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS guild_user_item_idx ON user_inventory(guild_id, user_id, item_id);

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        type VARCHAR(30) NOT NULL,
        currency_type VARCHAR(20) NOT NULL,
        amount INTEGER NOT NULL,
        balance BIGINT NOT NULL,
        source VARCHAR(50) NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS guild_user_tx_idx ON transactions(guild_id, user_id, created_at);

      -- ============================================
      -- GIVEAWAYS
      -- ============================================
      CREATE TABLE IF NOT EXISTS giveaways (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        message_id VARCHAR(20),
        host_id VARCHAR(20) NOT NULL,
        prize VARCHAR(256) NOT NULL,
        winner_count INTEGER NOT NULL DEFAULT 1,
        requirements JSONB NOT NULL DEFAULT '{}',
        winners JSONB NOT NULL DEFAULT '[]',
        is_active BOOLEAN NOT NULL DEFAULT true,
        starts_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ends_at TIMESTAMP NOT NULL,
        ended_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS giveaway_entries (
        id SERIAL PRIMARY KEY,
        giveaway_id INTEGER NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE,
        user_id VARCHAR(20) NOT NULL,
        entries INTEGER NOT NULL DEFAULT 1,
        entered_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS giveaway_user_idx ON giveaway_entries(giveaway_id, user_id);

      -- ============================================
      -- TICKETS
      -- ============================================
      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        ticket_number INTEGER NOT NULL,
        channel_id VARCHAR(20),
        user_id VARCHAR(20) NOT NULL,
        category_name VARCHAR(50),
        status ticket_status NOT NULL DEFAULT 'open',
        priority ticket_priority NOT NULL DEFAULT 'medium',
        claimed_by VARCHAR(20),
        transcript TEXT,
        form_responses JSONB,
        closed_by VARCHAR(20),
        close_reason TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        closed_at TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS guild_ticket_idx ON tickets(guild_id, ticket_number);

      -- ============================================
      -- CONFESSIONS
      -- ============================================
      CREATE TABLE IF NOT EXISTS confessions (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        confession_number INTEGER NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        message_id VARCHAR(20),
        is_approved BOOLEAN,
        is_reported BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- ============================================
      -- SUGGESTIONS
      -- ============================================
      CREATE TABLE IF NOT EXISTS suggestions (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        suggestion_number INTEGER NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        status suggestion_status NOT NULL DEFAULT 'pending',
        staff_response TEXT,
        staff_responder_id VARCHAR(20),
        message_id VARCHAR(20),
        upvotes INTEGER NOT NULL DEFAULT 0,
        downvotes INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        responded_at TIMESTAMP
      );

      -- ============================================
      -- REMINDERS
      -- ============================================
      CREATE TABLE IF NOT EXISTS reminders (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL,
        guild_id VARCHAR(20),
        channel_id VARCHAR(20),
        message TEXT NOT NULL,
        remind_at TIMESTAMP NOT NULL,
        is_recurring BOOLEAN NOT NULL DEFAULT false,
        recurring_interval INTEGER,
        is_dm BOOLEAN NOT NULL DEFAULT true,
        is_sent BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- ============================================
      -- REACTION ROLES
      -- ============================================
      CREATE TABLE IF NOT EXISTS reaction_roles (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        message_id VARCHAR(20) NOT NULL,
        type VARCHAR(20) NOT NULL,
        mode VARCHAR(20) NOT NULL DEFAULT 'normal',
        roles JSONB NOT NULL DEFAULT '[]',
        required_role_id VARCHAR(20),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- ============================================
      -- BOARD MESSAGES
      -- ============================================
      CREATE TABLE IF NOT EXISTS board_messages (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        board_type VARCHAR(20) NOT NULL,
        source_channel_id VARCHAR(20) NOT NULL,
        source_message_id VARCHAR(20) NOT NULL,
        board_message_id VARCHAR(20),
        author_id VARCHAR(20) NOT NULL,
        reaction_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS board_source_idx ON board_messages(guild_id, board_type, source_message_id);

      -- ============================================
      -- FORMS
      -- ============================================
      CREATE TABLE IF NOT EXISTS forms (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        questions JSONB NOT NULL DEFAULT '[]',
        response_channel_id VARCHAR(20),
        max_responses INTEGER,
        one_per_user BOOLEAN NOT NULL DEFAULT false,
        dm_confirm BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS form_responses (
        id SERIAL PRIMARY KEY,
        form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        user_id VARCHAR(20) NOT NULL,
        answers JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- ============================================
      -- COUNTING
      -- ============================================
      CREATE TABLE IF NOT EXISTS counting_state (
        guild_id VARCHAR(20) PRIMARY KEY,
        channel_id VARCHAR(20),
        current_count INTEGER NOT NULL DEFAULT 0,
        highest_count INTEGER NOT NULL DEFAULT 0,
        last_counter_id VARCHAR(20),
        total_counts BIGINT NOT NULL DEFAULT 0
      );

      -- ============================================
      -- SCHEDULED MESSAGES
      -- ============================================
      CREATE TABLE IF NOT EXISTS scheduled_messages (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        creator_id VARCHAR(20) NOT NULL,
        content TEXT,
        embed_data JSONB,
        scheduled_for TIMESTAMP,
        cron_expression VARCHAR(100),
        is_recurring BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_sent_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- ============================================
      -- CUSTOM COMMANDS
      -- ============================================
      CREATE TABLE IF NOT EXISTS custom_commands (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        name VARCHAR(50) NOT NULL,
        aliases JSONB NOT NULL DEFAULT '[]',
        response TEXT NOT NULL,
        embed_response BOOLEAN NOT NULL DEFAULT false,
        required_role_id VARCHAR(20),
        cooldown INTEGER NOT NULL DEFAULT 0,
        use_count INTEGER NOT NULL DEFAULT 0,
        created_by VARCHAR(20) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS custom_cmd_guild_name_idx ON custom_commands(guild_id, name);

      -- ============================================
      -- SERVER BACKUPS
      -- ============================================
      CREATE TABLE IF NOT EXISTS server_backups (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        data JSONB NOT NULL,
        created_by VARCHAR(20) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- ============================================
      -- STICKY MESSAGES
      -- ============================================
      CREATE TABLE IF NOT EXISTS sticky_messages (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        content TEXT,
        embed_data JSONB,
        current_message_id VARCHAR(20),
        interval INTEGER NOT NULL DEFAULT 5,
        messages_since INTEGER NOT NULL DEFAULT 0,
        priority INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true
      );

      -- ============================================
      -- ACTIVITY HOURLY
      -- ============================================
      CREATE TABLE IF NOT EXISTS activity_hourly (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        hour TIMESTAMP NOT NULL,
        messages INTEGER NOT NULL DEFAULT 0,
        voice_minutes INTEGER NOT NULL DEFAULT 0,
        reactions INTEGER NOT NULL DEFAULT 0,
        commands INTEGER NOT NULL DEFAULT 0
      );
      CREATE UNIQUE INDEX IF NOT EXISTS activity_guild_user_hour_idx ON activity_hourly(guild_id, user_id, hour);
      CREATE INDEX IF NOT EXISTS activity_guild_hour_idx ON activity_hourly(guild_id, hour);

      -- ============================================
      -- ACTIVITY TRACKING (daily aggregation, used by ActivityTracking module)
      -- ============================================
      CREATE TABLE IF NOT EXISTS activity_tracking (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        date DATE NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 0,
        voice_minutes INTEGER NOT NULL DEFAULT 0,
        reaction_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE UNIQUE INDEX IF NOT EXISTS activity_tracking_guild_user_date_idx ON activity_tracking(guild_id, user_id, date);
      CREATE INDEX IF NOT EXISTS activity_tracking_guild_date_idx ON activity_tracking(guild_id, date);

      -- ============================================
      -- MUSIC PLAYLISTS
      -- ============================================
      CREATE TABLE IF NOT EXISTS playlists (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        tracks JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS playlist_user_name_idx ON playlists(user_id, name);

      -- ============================================
      -- POLLS
      -- ============================================
      CREATE TABLE IF NOT EXISTS polls (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        message_id VARCHAR(20),
        creator_id VARCHAR(20) NOT NULL,
        question TEXT NOT NULL,
        options JSONB NOT NULL DEFAULT '[]',
        votes JSONB NOT NULL DEFAULT '{}',
        is_anonymous BOOLEAN NOT NULL DEFAULT false,
        max_choices INTEGER NOT NULL DEFAULT 1,
        show_live_results BOOLEAN NOT NULL DEFAULT true,
        is_active BOOLEAN NOT NULL DEFAULT true,
        ends_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- ============================================
      -- TEMP VOICE CHANNELS
      -- ============================================
      CREATE TABLE IF NOT EXISTS temp_voice_channels (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        owner_id VARCHAR(20) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      -- ============================================
      -- TRANSLATION CHANNELS
      -- ============================================
      CREATE TABLE IF NOT EXISTS translation_channels (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        target_lang VARCHAR(10) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS translation_channel_idx ON translation_channels(guild_id, channel_id);

      -- ============================================
      -- STATS CHANNELS
      -- ============================================
      CREATE TABLE IF NOT EXISTS stats_channels (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        type VARCHAR(30) NOT NULL,
        format VARCHAR(100) NOT NULL,
        custom_value INTEGER,
        last_updated TIMESTAMP
      );

      -- ============================================
      -- REPUTATION
      -- ============================================
      CREATE TABLE IF NOT EXISTS reputation_users (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        reputation INTEGER NOT NULL DEFAULT 80,
        last_active BIGINT NOT NULL DEFAULT 0
      );
      CREATE UNIQUE INDEX IF NOT EXISTS rep_guild_user_idx ON reputation_users(guild_id, user_id);

      CREATE TABLE IF NOT EXISTS reputation_history (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        given_by VARCHAR(20) NOT NULL,
        delta INTEGER NOT NULL,
        reason TEXT,
        created_at BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS rep_history_guild_user_idx ON reputation_history(guild_id, user_id);

      CREATE TABLE IF NOT EXISTS reputation_roles (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        role_id VARCHAR(20) NOT NULL,
        required_rep INTEGER NOT NULL,
        remove_on_drop BOOLEAN NOT NULL DEFAULT false
      );
      CREATE UNIQUE INDEX IF NOT EXISTS rep_role_guild_role_idx ON reputation_roles(guild_id, role_id);

      -- ============================================
      -- AUTOROLES
      -- ============================================
      CREATE TABLE IF NOT EXISTS autorole_rules (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        role_id VARCHAR(20) NOT NULL,
        condition VARCHAR(50) NOT NULL,
        condition_value TEXT,
        delay_seconds INTEGER NOT NULL DEFAULT 0,
        created_by VARCHAR(20) NOT NULL,
        created_at BIGINT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true
      );
      CREATE UNIQUE INDEX IF NOT EXISTS autorole_guild_role_cond_idx ON autorole_rules(guild_id, role_id, condition);

      CREATE TABLE IF NOT EXISTS autorole_persistent (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        member_id VARCHAR(20) NOT NULL,
        role_ids JSONB NOT NULL DEFAULT '[]',
        saved_at BIGINT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS autorole_persist_guild_member_idx ON autorole_persistent(guild_id, member_id);

      -- ============================================
      -- COLOR ROLES
      -- ============================================
      CREATE TABLE IF NOT EXISTS color_roles (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        hex VARCHAR(6) NOT NULL,
        role_id VARCHAR(20) NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        created_by VARCHAR(20) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS color_guild_hex_idx ON color_roles(guild_id, hex);
      CREATE UNIQUE INDEX IF NOT EXISTS color_guild_role_idx ON color_roles(guild_id, role_id);

      CREATE TABLE IF NOT EXISTS color_reaction_lists (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        message_id VARCHAR(20) NOT NULL,
        color_ids INTEGER[] NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS color_react_guild_msg_idx ON color_reaction_lists(guild_id, message_id);

      CREATE TABLE IF NOT EXISTS color_saves (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        colors JSONB NOT NULL DEFAULT '[]',
        created_by VARCHAR(20) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        export_code VARCHAR(255)
      );

      -- ============================================
      -- CUSTOM COMMANDS EXTENDED
      -- ============================================
      ALTER TABLE custom_commands ADD COLUMN IF NOT EXISTS dm BOOLEAN DEFAULT false;
      ALTER TABLE custom_commands ADD COLUMN IF NOT EXISTS ephemeral BOOLEAN DEFAULT false;
      ALTER TABLE custom_commands ADD COLUMN IF NOT EXISTS delete_invocation BOOLEAN DEFAULT false;
      ALTER TABLE custom_commands ADD COLUMN IF NOT EXISTS add_reaction VARCHAR(100);
      ALTER TABLE custom_commands ADD COLUMN IF NOT EXISTS allowed_channels JSONB DEFAULT '[]';

      -- InviteTracker columns on guild_members
      ALTER TABLE guild_members ADD COLUMN IF NOT EXISTS invites INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE guild_members ADD COLUMN IF NOT EXISTS bonus_invites INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE IF NOT EXISTS command_cooldowns (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        command_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        cooldown_expires_at TIMESTAMP NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS cmd_cd_guild_cmd_user_idx ON command_cooldowns(guild_id, command_id, user_id);

      CREATE TABLE IF NOT EXISTS custom_commands_config (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL UNIQUE,
        enabled BOOLEAN NOT NULL DEFAULT true,
        prefix VARCHAR(10) NOT NULL DEFAULT '!',
        max_commands INTEGER NOT NULL DEFAULT 50,
        allow_slash BOOLEAN NOT NULL DEFAULT true
      );

      -- ============================================
      -- FORMS CONFIG
      -- ============================================
      CREATE TABLE IF NOT EXISTS forms_config (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL UNIQUE,
        enabled BOOLEAN NOT NULL DEFAULT true,
        require_approval BOOLEAN NOT NULL DEFAULT false,
        notification_channel_id VARCHAR(20)
      );

      -- ============================================
      -- INVITE TRACKER
      -- ============================================
      CREATE TABLE IF NOT EXISTS invite_records (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        inviter_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        code VARCHAR(100),
        joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
        left_at TIMESTAMP,
        is_fake BOOLEAN NOT NULL DEFAULT false
      );
      CREATE UNIQUE INDEX IF NOT EXISTS invite_guild_user_code_idx ON invite_records(guild_id, user_id, code);
      CREATE INDEX IF NOT EXISTS invite_guild_inviter_idx ON invite_records(guild_id, inviter_id);

      CREATE TABLE IF NOT EXISTS guild_settings (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL UNIQUE,
        config JSONB NOT NULL DEFAULT '{}'
      );

      -- ============================================
      -- ANTI-RAID LOGS
      -- ============================================
      CREATE TABLE IF NOT EXISTS raid_logs (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        action VARCHAR(100) NOT NULL,
        details JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS raid_logs_guild_idx ON raid_logs(guild_id, created_at);

      -- ============================================
      -- TRANSLATION USER PREFS
      -- ============================================
      CREATE TABLE IF NOT EXISTS translation_user_prefs (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        language VARCHAR(10) NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS trans_user_pref_guild_user_idx ON translation_user_prefs(guild_id, user_id);

      -- Update translation_channels: add created_by if missing
      ALTER TABLE translation_channels ADD COLUMN IF NOT EXISTS created_by VARCHAR(20);

      -- ============================================
      -- USERPHONE HISTORY
      -- ============================================
      CREATE TABLE IF NOT EXISTS userphone_history (
        id SERIAL PRIMARY KEY,
        call_id VARCHAR(36) NOT NULL UNIQUE,
        guild1_id VARCHAR(20) NOT NULL,
        channel1_id VARCHAR(20) NOT NULL,
        guild2_id VARCHAR(20) NOT NULL,
        channel2_id VARCHAR(20) NOT NULL,
        started_at BIGINT NOT NULL,
        duration INTEGER NOT NULL DEFAULT 0
      );

      -- ============================================
      -- STICKY MESSAGES (camelCase — used by StickyMessages module)
      -- ============================================
      CREATE TABLE IF NOT EXISTS "stickyMessages" (
        id VARCHAR(100) PRIMARY KEY,
        "guildId" VARCHAR(20) NOT NULL,
        "channelId" VARCHAR(20) NOT NULL,
        content TEXT,
        "embedData" JSONB,
        "currentMessageId" VARCHAR(20),
        interval INTEGER NOT NULL DEFAULT 5,
        "messagesSince" INTEGER NOT NULL DEFAULT 0,
        priority INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "stickyConfigs" (
        id SERIAL PRIMARY KEY,
        "guildId" VARCHAR(20) NOT NULL UNIQUE,
        config JSONB NOT NULL DEFAULT '{}'
      );

      -- ============================================
      -- SCHEDULED MESSAGES CONFIG (camelCase — used by ScheduledMessages module)
      -- ============================================
      CREATE TABLE IF NOT EXISTS "scheduledMessagesConfig" (
        id SERIAL PRIMARY KEY,
        "guildId" VARCHAR(20) NOT NULL UNIQUE,
        enabled BOOLEAN NOT NULL DEFAULT true,
        "maxScheduledPerGuild" INTEGER NOT NULL DEFAULT 25,
        timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );
    `);

    // ============================================
    // One-time fix: re-enable all modules that were incorrectly inserted as
    // disabled due to the old `enabled: update.enabled ?? false` bug in
    // upsertConfig. Safe because the dashboard isn't hosted yet, so no
    // module has been intentionally disabled by anyone.
    // TODO: Remove this block once all guilds have been fixed.
    // ============================================
    const fixResult = await pool.query(`
      UPDATE guild_module_configs
      SET enabled = true, updated_at = NOW()
      WHERE enabled = false
    `);
    if (fixResult.rowCount && fixResult.rowCount > 0) {
      logger.info('Re-enabled ' + fixResult.rowCount + ' modules that were incorrectly disabled');
    }

    // ============================================
    // Userphone Reports & Server Bans
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS userphone_reports (
        id SERIAL PRIMARY KEY,
        call_id VARCHAR(64) NOT NULL,
        reporter_guild_id VARCHAR(20) NOT NULL,
        reporter_user_id VARCHAR(20) NOT NULL,
        reported_guild_id VARCHAR(20) NOT NULL,
        reason TEXT NOT NULL,
        transcript TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        staff_notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP,
        resolved_by VARCHAR(20)
      );
      CREATE INDEX IF NOT EXISTS userphone_reports_guild_idx ON userphone_reports(reported_guild_id);

      CREATE TABLE IF NOT EXISTS userphone_server_bans (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        reason TEXT NOT NULL,
        report_id INTEGER REFERENCES userphone_reports(id),
        banned_at TIMESTAMP DEFAULT NOW(),
        banned_by VARCHAR(20) NOT NULL,
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      );
      CREATE UNIQUE INDEX IF NOT EXISTS userphone_ban_guild_idx ON userphone_server_bans(guild_id) WHERE is_active = true;
    `);

    // Userphone contacts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS userphone_contacts (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        contact_guild_id VARCHAR(20) NOT NULL,
        contact_guild_name VARCHAR(100) NOT NULL,
        added_by VARCHAR(20) NOT NULL,
        added_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(guild_id, contact_guild_id)
      );
      CREATE INDEX IF NOT EXISTS userphone_contacts_guild_idx ON userphone_contacts(guild_id);
    `);

    // ============================================
    // AUTOMOD LOGS
    // ============================================
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE automod_action_type AS ENUM ('delete', 'warn', 'mute', 'kick', 'ban');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      CREATE TABLE IF NOT EXISTS automod_logs (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
        target_id VARCHAR(20) NOT NULL,
        action automod_action_type NOT NULL,
        violation_type VARCHAR(50) NOT NULL,
        reason TEXT,
        message_content TEXT,
        channel_id VARCHAR(20),
        duration INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS automod_guild_idx ON automod_logs(guild_id, created_at);
      CREATE INDEX IF NOT EXISTS automod_guild_target_idx ON automod_logs(guild_id, target_id);
    `);

    // ============================================
    // Reputation default update: 0 → 80
    // ============================================
    await pool.query(`
      ALTER TABLE guild_members ALTER COLUMN reputation SET DEFAULT 80;
      ALTER TABLE reputation_users ALTER COLUMN reputation SET DEFAULT 80;

      -- Update existing users stuck at 0 (never been adjusted) to the new default
      UPDATE guild_members SET reputation = 80 WHERE reputation = 0;
      UPDATE reputation_users SET reputation = 80 WHERE reputation = 0;
    `);

    logger.info('All migrations completed successfully');
  } catch (err: any) {
    logger.error('Migration failed', { error: err.message });
    throw err;
  } finally {
    await pool.end();
  }
}

// Run if called directly
migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
