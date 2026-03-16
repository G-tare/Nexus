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

    // ============================================
    // Voice Phone History
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS voicephone_history (
        id SERIAL PRIMARY KEY,
        call_id VARCHAR(50) NOT NULL UNIQUE,
        guild1_id VARCHAR(20) NOT NULL,
        voice_channel1_id VARCHAR(20) NOT NULL,
        guild2_id VARCHAR(20) NOT NULL,
        voice_channel2_id VARCHAR(20) NOT NULL,
        started_at BIGINT NOT NULL,
        duration INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS voicephone_guild1_idx ON voicephone_history(guild1_id);
      CREATE INDEX IF NOT EXISTS voicephone_guild2_idx ON voicephone_history(guild2_id);
    `);

    // ============================================
    // Voice Phone Permanent Bans
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS voicephone_permanent_bans (
        user_id VARCHAR(20) PRIMARY KEY,
        reason TEXT NOT NULL,
        banned_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // ============================================
    // BANKS (Currency Banking System)
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS banks (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        balance BIGINT NOT NULL DEFAULT 0,
        savings_balance BIGINT NOT NULL DEFAULT 0,
        savings_locked_until TIMESTAMP,
        savings_interest_rate NUMERIC(5,4) NOT NULL DEFAULT 0.005,
        deposit_limit BIGINT NOT NULL DEFAULT 10000,
        daily_deposited BIGINT NOT NULL DEFAULT 0,
        padlock_active BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS banks_guild_user_idx ON banks(guild_id, user_id);
    `);

    // ============================================
    // JOB LISTINGS (Currency Jobs System)
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS job_listings (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        tier INTEGER NOT NULL DEFAULT 1,
        base_salary BIGINT NOT NULL DEFAULT 100,
        required_level INTEGER NOT NULL DEFAULT 0,
        required_reputation INTEGER NOT NULL DEFAULT 0,
        max_workers INTEGER,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS job_listings_guild_idx ON job_listings(guild_id, tier);
    `);

    // ============================================
    // USER JOBS (Currency Jobs System)
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_jobs (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        job_id INTEGER NOT NULL,
        tier INTEGER NOT NULL DEFAULT 1,
        salary BIGINT NOT NULL DEFAULT 100,
        shifts_completed INTEGER NOT NULL DEFAULT 0,
        warning_count INTEGER NOT NULL DEFAULT 0,
        promotion_progress INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        hired_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_shift TIMESTAMP,
        fired_at TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS user_jobs_guild_user_idx ON user_jobs(guild_id, user_id) WHERE is_active = true;
    `);

    // ============================================
    // CRIME LOGS (Currency Earning System)
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS crime_logs (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        action VARCHAR(30) NOT NULL,
        success BOOLEAN NOT NULL,
        amount BIGINT NOT NULL DEFAULT 0,
        target_id VARCHAR(20),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS crime_logs_guild_user_idx ON crime_logs(guild_id, user_id, created_at);
    `);

    // ============================================
    // CASINO HISTORY
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS casino_history (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        game VARCHAR(30) NOT NULL,
        bet_amount BIGINT NOT NULL DEFAULT 0,
        win_amount BIGINT NOT NULL DEFAULT 0,
        multiplier NUMERIC(10,2) NOT NULL DEFAULT 0,
        result VARCHAR(10) NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS casino_history_guild_user_idx ON casino_history(guild_id, user_id, created_at);
      CREATE INDEX IF NOT EXISTS casino_history_guild_game_idx ON casino_history(guild_id, game);
    `);

    // ============================================
    // FAMILY RELATIONSHIPS
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS family_relationships (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        partner_id VARCHAR(20),
        parent_id VARCHAR(20),
        married_at TIMESTAMP,
        adopted_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS family_guild_user_idx ON family_relationships(guild_id, user_id);
    `);

    // ============================================
    // FAMILY PENDING REQUESTS
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS family_pending_requests (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        from_user_id VARCHAR(20) NOT NULL,
        to_user_id VARCHAR(20) NOT NULL,
        type VARCHAR(20) NOT NULL,
        message_id VARCHAR(20),
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS family_pending_guild_idx ON family_pending_requests(guild_id, to_user_id);
    `);

    // ============================================
    // PROFILES
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        about_me TEXT,
        age INTEGER,
        gender VARCHAR(30),
        location VARCHAR(100),
        status VARCHAR(200),
        birthday VARCHAR(10),
        profile_color VARCHAR(7),
        banner_url TEXT,
        favorite_actors JSONB DEFAULT '[]',
        favorite_artists JSONB DEFAULT '[]',
        favorite_foods JSONB DEFAULT '[]',
        favorite_hobbies JSONB DEFAULT '[]',
        favorite_movies JSONB DEFAULT '[]',
        favorite_pets JSONB DEFAULT '[]',
        favorite_songs JSONB DEFAULT '[]',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS profiles_guild_user_idx ON profiles(guild_id, user_id);
    `);

    // ============================================
    // SOUNDBOARD SOUNDS
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS soundboard_sounds (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        name VARCHAR(50) NOT NULL,
        url TEXT NOT NULL,
        category VARCHAR(30),
        added_by VARCHAR(20) NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT false,
        play_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS soundboard_guild_name_idx ON soundboard_sounds(guild_id, name);
    `);

    // ============================================
    // REPORTS (Bug & User Reports)
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        reporter_id VARCHAR(20) NOT NULL,
        type VARCHAR(20) NOT NULL,
        target_id VARCHAR(20),
        reason TEXT NOT NULL,
        evidence TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        staff_notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMP,
        resolved_by VARCHAR(20)
      );
      CREATE INDEX IF NOT EXISTS reports_guild_idx ON reports(guild_id, status);
    `);

    // ============================================
    // TICKET NOTICES
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ticket_notices (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        ticket_id INTEGER NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        message_id VARCHAR(20),
        content TEXT NOT NULL,
        author_id VARCHAR(20) NOT NULL,
        is_pinned BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS ticket_notices_guild_ticket_idx ON ticket_notices(guild_id, ticket_id);
    `);

    // ============================================
    // RAFFLES
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS raffles (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        message_id VARCHAR(20),
        host_id VARCHAR(20) NOT NULL,
        prize VARCHAR(256) NOT NULL,
        description TEXT,
        winner_count INTEGER NOT NULL DEFAULT 1,
        ticket_price INTEGER NOT NULL DEFAULT 0,
        currency_type VARCHAR(20) NOT NULL DEFAULT 'coins',
        max_tickets_per_user INTEGER NOT NULL DEFAULT 10,
        max_total_tickets INTEGER,
        required_role_id VARCHAR(20),
        winners JSONB NOT NULL DEFAULT '[]',
        is_active BOOLEAN NOT NULL DEFAULT true,
        starts_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ends_at TIMESTAMP NOT NULL,
        ended_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS raffle_entries (
        id SERIAL PRIMARY KEY,
        raffle_id INTEGER NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
        user_id VARCHAR(20) NOT NULL,
        tickets INTEGER NOT NULL DEFAULT 1,
        total_spent INTEGER NOT NULL DEFAULT 0,
        entered_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS raffle_user_idx ON raffle_entries(raffle_id, user_id);
    `);

    // ============================================
    // DONATIONS
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS donations (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        amount INTEGER NOT NULL,
        currency_type VARCHAR(20) NOT NULL DEFAULT 'coins',
        campaign_name VARCHAR(100),
        message TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS guild_donation_idx ON donations(guild_id, created_at);
      CREATE INDEX IF NOT EXISTS guild_user_donation_idx ON donations(guild_id, user_id);

      CREATE TABLE IF NOT EXISTS donation_campaigns (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        goal INTEGER NOT NULL DEFAULT 0,
        currency_type VARCHAR(20) NOT NULL DEFAULT 'coins',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_by VARCHAR(20) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ends_at TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS donation_campaign_guild_name_idx ON donation_campaigns(guild_id, name);
    `);

    // ============================================
    // TIMERS
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS timers (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        label VARCHAR(200) NOT NULL,
        channel_id VARCHAR(20),
        message_id VARCHAR(20),
        notify_in_dm BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        starts_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ends_at TIMESTAMP NOT NULL,
        ended_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS timers_guild_user_idx ON timers(guild_id, user_id);
      CREATE INDEX IF NOT EXISTS timers_active_ends_idx ON timers(is_active, ends_at);
    `);

    // Backfill: add ended_at column if table already existed without it
    await pool.query(`
      ALTER TABLE timers ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP;
    `);

    // ============================================
    // PREMIUM TIER ENUM MIGRATION (3-tier → 4-tier)
    // ============================================
    // Add new enum values if they don't exist
    await pool.query(`
      DO $$ BEGIN
        ALTER TYPE premium_tier ADD VALUE IF NOT EXISTS 'pro';
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await pool.query(`
      DO $$ BEGIN
        ALTER TYPE premium_tier ADD VALUE IF NOT EXISTS 'plus';
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // Migrate existing 'ultimate' data to 'premium' (ultimate no longer used)
    // Since we can't remove enum values, we just migrate the data
    await pool.query(`
      UPDATE guilds SET premium_tier = 'premium' WHERE premium_tier = 'ultimate';
    `);

    // ============================================
    // GUILDS TABLE — add new columns
    // ============================================
    await pool.query(`
      ALTER TABLE guilds ADD COLUMN IF NOT EXISTS icon VARCHAR(64);
      ALTER TABLE guilds ADD COLUMN IF NOT EXISTS member_count INTEGER NOT NULL DEFAULT 0;
    `);

    // ============================================
    // NEW ENUMS for bot tickets, staff, toggles, subscriptions
    // ============================================
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE bot_ticket_category AS ENUM ('help', 'appeal', 'suggestion', 'bug', 'feedback');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE bot_ticket_status AS ENUM ('open', 'claimed', 'closed');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE bot_ticket_author_type AS ENUM ('user', 'staff');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE bot_staff_role AS ENUM ('support', 'manager', 'owner');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE global_toggle_reason AS ENUM ('update', 'glitch', 'issue', 'misuse');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE premium_sub_status AS ENUM ('active', 'expired', 'cancelled');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // ============================================
    // BOT TICKETS
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_tickets (
        id SERIAL PRIMARY KEY,
        ticket_number SERIAL,
        guild_id VARCHAR(20),
        user_id VARCHAR(20) NOT NULL,
        username VARCHAR(100) NOT NULL,
        category bot_ticket_category NOT NULL,
        subcategory VARCHAR(100),
        status bot_ticket_status NOT NULL DEFAULT 'open',
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        claimed_by VARCHAR(20),
        closed_by VARCHAR(20),
        closed_reason TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        closed_at TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS bot_ticket_status_idx ON bot_tickets(status, created_at);
      CREATE INDEX IF NOT EXISTS bot_ticket_category_idx ON bot_tickets(category);
      CREATE INDEX IF NOT EXISTS bot_ticket_user_idx ON bot_tickets(user_id);
    `);

    // ============================================
    // BOT TICKET MESSAGES
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_ticket_messages (
        id SERIAL PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES bot_tickets(id) ON DELETE CASCADE,
        author_type bot_ticket_author_type NOT NULL,
        author_id VARCHAR(20) NOT NULL,
        author_name VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        dm_message_id VARCHAR(20),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS bot_ticket_msg_ticket_idx ON bot_ticket_messages(ticket_id, created_at);
    `);

    // ============================================
    // BOT STAFF
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_staff (
        id SERIAL PRIMARY KEY,
        discord_id VARCHAR(20) NOT NULL UNIQUE,
        username VARCHAR(100) NOT NULL,
        avatar_hash VARCHAR(64),
        role bot_staff_role NOT NULL DEFAULT 'support',
        permissions JSONB NOT NULL DEFAULT '{}',
        added_by VARCHAR(20) NOT NULL,
        added_at TIMESTAMP NOT NULL DEFAULT NOW(),
        removed_at TIMESTAMP
      );
    `);

    // ============================================
    // COMMAND USAGE TRACKING
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS command_usage (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        module_name VARCHAR(50) NOT NULL,
        command_name VARCHAR(100) NOT NULL,
        subcommand_name VARCHAR(100),
        execution_ms INTEGER,
        success BOOLEAN NOT NULL DEFAULT true,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS cmd_usage_module_idx ON command_usage(module_name, timestamp);
      CREATE INDEX IF NOT EXISTS cmd_usage_guild_idx ON command_usage(guild_id, timestamp);
      CREATE INDEX IF NOT EXISTS cmd_usage_command_idx ON command_usage(command_name, timestamp);
      CREATE INDEX IF NOT EXISTS cmd_usage_timestamp_idx ON command_usage(timestamp);
    `);

    // ============================================
    // GLOBAL MODULE TOGGLES
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS global_module_toggles (
        id SERIAL PRIMARY KEY,
        module_name VARCHAR(50) NOT NULL UNIQUE,
        enabled BOOLEAN NOT NULL DEFAULT true,
        reason global_toggle_reason,
        reason_detail TEXT,
        disabled_by VARCHAR(20),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // ============================================
    // SERVER-SPECIFIC MODULE BANS
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS server_module_bans (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        module_name VARCHAR(50) NOT NULL,
        reason VARCHAR(50),
        reason_detail TEXT,
        banned_by VARCHAR(20) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS server_module_ban_idx ON server_module_bans(guild_id, module_name);
    `);

    // ============================================
    // ALERT RULES & HISTORY
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alert_rules (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        metric_type VARCHAR(50) NOT NULL,
        operator VARCHAR(10) NOT NULL,
        threshold REAL NOT NULL,
        webhook_url TEXT,
        discord_channel_id VARCHAR(20),
        enabled BOOLEAN NOT NULL DEFAULT true,
        created_by VARCHAR(20) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS alert_history (
        id SERIAL PRIMARY KEY,
        rule_id INTEGER NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
        triggered_at TIMESTAMP NOT NULL DEFAULT NOW(),
        value REAL NOT NULL,
        message TEXT NOT NULL,
        resolved BOOLEAN NOT NULL DEFAULT false
      );
      CREATE INDEX IF NOT EXISTS alert_history_rule_idx ON alert_history(rule_id, triggered_at);
    `);

    // ============================================
    // PREMIUM SUBSCRIPTIONS (revenue tracking)
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS premium_subscriptions (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        tier premium_tier NOT NULL,
        start_date TIMESTAMP NOT NULL DEFAULT NOW(),
        expiry_date TIMESTAMP,
        amount REAL NOT NULL DEFAULT 0,
        status premium_sub_status NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS premium_sub_guild_idx ON premium_subscriptions(guild_id);
      CREATE INDEX IF NOT EXISTS premium_sub_status_idx ON premium_subscriptions(status);
    `);

    // ============================================
    // USER BLOCKLIST (bot-wide user blocks)
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_blocklist (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL UNIQUE,
        reason TEXT NOT NULL,
        blocked_by VARCHAR(20) NOT NULL,
        blocked_at TIMESTAMP NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMP
      );
    `);

    // ============================================
    // USERPHONE USER-LEVEL BANS
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS userphone_user_bans (
        user_id VARCHAR(20) PRIMARY KEY,
        reason TEXT NOT NULL,
        banned_by VARCHAR(20) NOT NULL,
        banned_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // ============================================
    // BOT ANNOUNCEMENTS
    // ============================================
    await pool.query(`
      -- Bot announcements (owner broadcasts)
      CREATE TABLE IF NOT EXISTS bot_announcements (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'info',
        author_id VARCHAR(20) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ============================================
    // MIGRATIONS — Add dm_thread_id to bot_tickets
    // (Discord thread ID created under the first DM for this ticket)
    // ============================================
    await pool.query(`
      ALTER TABLE bot_tickets ADD COLUMN IF NOT EXISTS dm_thread_id VARCHAR(20);
    `);

    // ============================================
    // MIGRATIONS — Add attachments column to bot_ticket_messages
    // (JSON array of { url, filename, contentType } objects)
    // ============================================
    await pool.query(`
      ALTER TABLE bot_ticket_messages ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
    `);

    // ============================================
    // MIGRATIONS — Add last_staff_read_at to bot_tickets (for unread tracking)
    // ============================================
    await pool.query(`
      ALTER TABLE bot_tickets ADD COLUMN IF NOT EXISTS last_staff_read_at TIMESTAMP;
    `);

    // ============================================
    // BOT TICKET BANS — Users banned from creating tickets
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_ticket_bans (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL,
        username VARCHAR(100) NOT NULL DEFAULT '',
        banned_by VARCHAR(20) NOT NULL,
        reason TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS bot_ticket_ban_user_idx ON bot_ticket_bans(user_id);
    `);

    // ============================================
    // BANKS — Add missing columns
    // ============================================
    await pool.query(`
      ALTER TABLE banks ADD COLUMN IF NOT EXISTS savings_deposited_at TIMESTAMP;
      ALTER TABLE banks ADD COLUMN IF NOT EXISTS last_interest_paid TIMESTAMP;
      ALTER TABLE banks ADD COLUMN IF NOT EXISTS last_deposit_reset TIMESTAMP;
      ALTER TABLE banks ADD COLUMN IF NOT EXISTS padlock_expires TIMESTAMP;
    `);

    // ============================================
    // BOT MANAGERS — Roles/users that can manage the bot per guild
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_managers (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
        target_type VARCHAR(10) NOT NULL,
        target_id VARCHAR(20) NOT NULL,
        added_by VARCHAR(20) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS bot_managers_guild_idx ON bot_managers(guild_id);
      CREATE UNIQUE INDEX IF NOT EXISTS bot_managers_unique ON bot_managers(guild_id, target_type, target_id);
    `);

    // ============================================
    // TEMP BANS
    // ============================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS temp_bans (
        id SERIAL PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        moderator_id VARCHAR(20) NOT NULL,
        reason TEXT,
        case_number INTEGER,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS temp_bans_guild_idx ON temp_bans(guild_id);
      CREATE INDEX IF NOT EXISTS temp_bans_expires_idx ON temp_bans(expires_at);
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
