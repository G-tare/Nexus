/**
 * Quarantine Role Auto-Setup
 *
 * When a quarantine role is selected in the config (via /configs or dashboard),
 * this automatically sets up channel permission overrides on ALL channels
 * to deny View Channel for that role, so quarantined members can't see anything.
 *
 * Also cleans up old overrides if the quarantine role is changed.
 */

import { Client } from 'discord.js';
import { eventBus } from '../../Shared/src/events/eventBus';
import { moduleConfig } from '../../Shared/src/middleware/moduleConfig';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import type { ModerationConfig } from './helpers';

const logger = createModuleLogger('QuarantineSetup');

/**
 * Register the configUpdated listener for quarantine role auto-setup.
 * Must be called once with the bot client.
 */
export function registerQuarantineSetup(client: Client): void {
  eventBus.on('configUpdated', async (data) => {
    if (data.moduleName !== 'moderation') return;

    const oldRoleId = data.oldConfig.quarantineRoleId as string | null | undefined;
    const newRoleId = data.newConfig.quarantineRoleId as string | null | undefined;

    // Only act if the quarantine role actually changed
    if (oldRoleId === newRoleId) return;

    const guild = client.guilds.cache.get(data.guildId);
    if (!guild) return;

    // If there was an old role, clean up its overrides
    if (oldRoleId) {
      await cleanupQuarantineOverrides(guild, oldRoleId);
    }

    // If a new role is set, apply deny overrides to all channels
    if (newRoleId) {
      await applyQuarantineOverrides(guild, newRoleId);
    }
  });

  logger.info('Quarantine role auto-setup listener registered');
}

/**
 * Apply View Channel deny overrides to ALL guild channels for the given role.
 */
async function applyQuarantineOverrides(
  guild: import('discord.js').Guild,
  roleId: string,
): Promise<void> {
  const role = guild.roles.cache.get(roleId);
  if (!role) {
    logger.warn(`Quarantine role ${roleId} not found in guild ${guild.id}`);
    return;
  }

  logger.info(`Setting up quarantine role overrides for ${role.name} (${roleId}) in ${guild.name}`);

  // Get the appeals channel (if configured) so we can skip it — quarantined
  // users need to keep access to the appeals channel.
  let appealChannelId: string | null = null;
  try {
    const modCfg = await moduleConfig.getModuleConfig<ModerationConfig>(guild.id, 'moderation');
    appealChannelId = modCfg?.config?.appealChannelId ?? null;
  } catch {
    // Non-fatal
  }

  let successCount = 0;
  let failCount = 0;

  // Fetch all channels to ensure cache is fresh
  const channels = await guild.channels.fetch();

  for (const [, channel] of channels) {
    if (!channel) continue;

    // Skip the appeals channel — quarantined users must keep access there
    if (appealChannelId && channel.id === appealChannelId) {
      logger.debug(`Skipping appeals channel #${channel.name} for quarantine overrides`);
      continue;
    }

    try {
      await channel.permissionOverwrites.edit(roleId, {
        ViewChannel: false,
        SendMessages: false,
        AddReactions: false,
        Connect: false,
        Speak: false,
      }, { reason: 'Quarantine role auto-setup: deny all access' });
      successCount++;
    } catch (err: any) {
      // Some channels might not support overrides (e.g. category children inherit)
      logger.debug(`Failed to set quarantine override on ${channel.name}: ${err.message}`);
      failCount++;
    }
  }

  logger.info(`Quarantine setup complete for ${guild.name}: ${successCount} channels configured, ${failCount} skipped`);
}

/**
 * Remove quarantine overrides from all channels for the old role.
 */
async function cleanupQuarantineOverrides(
  guild: import('discord.js').Guild,
  roleId: string,
): Promise<void> {
  logger.info(`Cleaning up old quarantine overrides for role ${roleId} in ${guild.name}`);

  const channels = await guild.channels.fetch();
  let cleaned = 0;

  for (const [, channel] of channels) {
    if (!channel) continue;

    try {
      const override = channel.permissionOverwrites.cache.get(roleId);
      if (override) {
        await override.delete('Quarantine role changed: cleaning up old overrides');
        cleaned++;
      }
    } catch (err: any) {
      logger.debug(`Failed to clean quarantine override on ${channel.name}: ${err.message}`);
    }
  }

  logger.info(`Cleaned up ${cleaned} quarantine overrides in ${guild.name}`);
}
