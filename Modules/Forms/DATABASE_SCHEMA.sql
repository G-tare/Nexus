-- Forms module database schema

-- Forms table
CREATE TABLE IF NOT EXISTS forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  response_channel_id VARCHAR(20) NOT NULL,
  max_responses INTEGER,
  one_per_user BOOLEAN NOT NULL DEFAULT true,
  dm_confirm BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_guild FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

-- Create index for guild lookups
CREATE INDEX IF NOT EXISTS idx_forms_guild_id ON forms(guild_id);
CREATE INDEX IF NOT EXISTS idx_forms_is_active ON forms(is_active);

-- Form responses table
CREATE TABLE IF NOT EXISTS form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL,
  user_id VARCHAR(20) NOT NULL,
  answers JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  reviewed_by VARCHAR(20),
  review_notes TEXT,
  CONSTRAINT fk_form FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'denied'))
);

-- Create indexes for response lookups
CREATE INDEX IF NOT EXISTS idx_form_responses_form_id ON form_responses(form_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_user_id ON form_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_form_responses_status ON form_responses(status);
CREATE INDEX IF NOT EXISTS idx_form_responses_form_user ON form_responses(form_id, user_id);

-- Forms configuration table
CREATE TABLE IF NOT EXISTS forms_config (
  guild_id VARCHAR(20) PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  require_approval BOOLEAN NOT NULL DEFAULT false,
  notification_channel_id VARCHAR(20),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_guild_config FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

-- Create index for config lookups
CREATE INDEX IF NOT EXISTS idx_forms_config_guild_id ON forms_config(guild_id);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_forms_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_forms_updated_at ON forms;
CREATE TRIGGER update_forms_updated_at
  BEFORE UPDATE ON forms
  FOR EACH ROW
  EXECUTE FUNCTION update_forms_timestamp();

DROP TRIGGER IF EXISTS update_forms_config_updated_at ON forms_config;
CREATE TRIGGER update_forms_config_updated_at
  BEFORE UPDATE ON forms_config
  FOR EACH ROW
  EXECUTE FUNCTION update_forms_timestamp();
