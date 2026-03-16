import {
  Client,
  Events,
  Role,
  GuildChannel,
} from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { cache } from '../../Shared/src/cache/cacheManager';
import { eventBus } from '../../Shared/src/events/eventBus';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import {
  createBackup,
  getBackupConfig,
  getBackupList,
} from './helpers';

const logger = createModuleLogger('Backup:Events');

// Track auto-backup intervals
const autoBackupIntervals = new Map<string, NodeJS.Timeout>();

// ============================================
// Client Ready — Start Auto-Backup Scheduler
// ============================================

const clientReadyHandler: ModuleEvent = { event: Events.ClientReady,
  once: true,
  async handler(client: Client) {
    logger.info('Starting auto-backup scheduler');

    for (const [guildId, guild] of client.guilds.cache) {
      const config = await getBackupConfig(guildId);
      if (config.autoBackupInterval > 0) {
        startAutoBackup(client, guildId, config.autoBackupInterval);
      }
    }

    logger.info(`Auto-backup started for ${autoBackupIntervals.size} guilds`);
  },
};

/**
 * Start an auto-backup interval for a guild.
 */
function startAutoBackup(client: Client, guildId: string, intervalHours: number) {
  const existing = autoBackupIntervals.get(guildId);
  if (existing) clearInterval(existing);

  const intervalMs = intervalHours * 60 * 60 * 1000;

  const interval = setInterval(async () => {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      clearInterval(interval);
      autoBackupIntervals.delete(guildId);
      return;
    }

    try {
      const date = new Date().toISOString().split('T')[0];
      await createBackup(guild, `Auto-backup ${date}`, 'auto');
      logger.info('Auto-backup completed', { guildId });
    } catch (err: any) {
      logger.error('Auto-backup failed', { guildId, error: err.message });
    }
  }, intervalMs);

  autoBackupIntervals.set(guildId, interval);
}

// ============================================
// Change-Triggered Backup — Role/Channel Changes
// ============================================

const roleChangeHandler: ModuleEvent = { event: Events.GuildRoleCreate,
  async handler(role: Role) {
    await triggerChangeBackup(role.guild.id, role.client);
  },
};

const roleDeleteHandler: ModuleEvent = { event: Events.GuildRoleDelete,
  async handler(role: Role) {
    await triggerChangeBackup(role.guild.id, role.client);
  },
};

const channelCreateHandler: ModuleEvent = { event: Events.ChannelCreate,
  async handler(channel: GuildChannel) {
    if (!channel.guild) return;
    await triggerChangeBackup(channel.guild.id, channel.client);
  },
};

const channelDeleteHandler: ModuleEvent = { event: Events.ChannelDelete,
  async handler(channel: any) {
    if (!channel.guild) return;
    await triggerChangeBackup(channel.guild.id, channel.client);
  },
};

/**
 * Trigger a change-based backup with cooldown.
 */
async function triggerChangeBackup(guildId: string, client: Client): Promise<void> {
  const config = await getBackupConfig(guildId);
  if (!config.backupOnChange) return;

  const cooldownKey = `backup:changecooldown:${guildId}`;
  const onCooldown = await cache.has(cooldownKey);
  if (onCooldown) return;

  // Set cooldown
  await cache.set(cooldownKey, '1', config.changeCooldown * 60);

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  try {
    const date = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await createBackup(guild, `Change-triggered ${date}`, 'auto');
    logger.info('Change-triggered backup created', { guildId });
  } catch (err: any) {
    logger.error('Change-triggered backup failed', { guildId, error: err.message });
  }
}

export const backupEvents: ModuleEvent[] = [
  clientReadyHandler,
  roleChangeHandler,
  roleDeleteHandler,
  channelCreateHandler,
  channelDeleteHandler,
];
