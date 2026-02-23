-- Invite Tracker Module Database Schema
-- These tables and columns must exist in your database for the Invite Tracker module to work

-- 1. Add columns to guild_members table (if not already present)
-- These columns track invite data for users
ALTER TABLE guild_members
ADD COLUMN IF NOT EXISTS invites INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_invites INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_guild_members_invites ON guild_members(guild_id, invites);
CREATE INDEX IF NOT EXISTS idx_guild_members_invited_by ON guild_members(guild_id, invited_by);

-- 2. Create invite_records table
-- This table stores detailed information about each invite event
CREATE TABLE IF NOT EXISTS invite_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id BIGINT NOT NULL,
  inviter_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  code VARCHAR(255) NOT NULL,
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP,
  is_fake BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Composite index for efficient queries
  CONSTRAINT unique_invite_join UNIQUE (guild_id, user_id, code)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_invite_records_guild_inviter ON invite_records(guild_id, inviter_id);
CREATE INDEX IF NOT EXISTS idx_invite_records_guild_user ON invite_records(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_invite_records_joined_at ON invite_records(joined_at);
CREATE INDEX IF NOT EXISTS idx_invite_records_left_at ON invite_records(left_at);
CREATE INDEX IF NOT EXISTS idx_invite_records_is_fake ON invite_records(is_fake);

-- 3. Ensure guild_settings table has config column (if not already present)
-- This is used to store module-specific configuration
ALTER TABLE guild_settings
ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_guild_settings_config ON guild_settings USING GIN (config);

-- Sample config structure for invitetracker in guild_settings.config:
-- {
--   "invitetracker": {
--     "enabled": true,
--     "trackJoins": true,
--     "trackLeaves": true,
--     "trackFakes": true,
--     "fakeAccountAgeDays": 7,
--     "fakeLeaveHours": 24,
--     "logChannelId": "123456789",
--     "announceJoins": false,
--     "announceChannelId": "987654321"
--   }
-- }
