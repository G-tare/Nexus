import { Client, VoiceChannel, Guild } from 'discord.js';
import { createModuleLogger } from '../../Shared/src/utils/logger';
const logger = createModuleLogger('TempVoice');
import {
  getTempVCByChannelId,
  deleteTempVC,
  getGuildTempVCs,
  auditLog,
} from './helpers';

/**
 * Cleanup manager for orphaned and empty temp VCs
 */
export class TempVCCleanupManager {
  private client: Client;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 60000; // 60 seconds

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Start the cleanup interval
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('[TempVoice] Cleanup manager already running');
      return;
    }

    this.intervalId = setInterval(() => {
      this.runCleanup();
    }, this.CHECK_INTERVAL);

    logger.info('[TempVoice] Cleanup manager started');
  }

  /**
   * Stop the cleanup interval
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('[TempVoice] Cleanup manager stopped');
    }
  }

  /**
   * Run a single cleanup cycle
   */
  private async runCleanup(): Promise<void> {
    try {
      // Check all guilds
      for (const [, guild] of this.client.guilds.cache) {
        await this.cleanupGuildChannels(guild);
      }
    } catch (error) {
      logger.error('[TempVoice] Error during cleanup cycle:', error);
    }
  }

  /**
   * Cleanup channels in a specific guild
   */
  private async cleanupGuildChannels(guild: Guild): Promise<void> {
    try {
      const tempVCs = await getGuildTempVCs(guild.id);

      for (const tempVC of tempVCs) {
        try {
          // Try to get the channel
          const channel = guild.channels.cache.get(tempVC.channelId);

          if (!channel) {
            // Channel doesn't exist, remove from database
            logger.info('[TempVoice] Removing orphaned temp VC record:', tempVC.channelId);
            await deleteTempVC(tempVC.channelId);
            await auditLog(guild, 'orphaned_vc_removed', tempVC.channelId, 'system');
            continue;
          }

          if (!(channel instanceof VoiceChannel)) {
            // Not a voice channel, remove record
            logger.warn('[TempVoice] Non-voice channel found for temp VC:', channel.id);
            await deleteTempVC(channel.id);
            await auditLog(guild, 'invalid_vc_removed', channel.id, 'system');
            continue;
          }

          // Check if channel is empty
          const members = await channel.members;
          if (members.size === 0) {
            // Empty channel - check if it has a deletion scheduled
            // If not, this shouldn't happen, but delete it to be safe
            logger.info('[TempVoice] Found empty temp VC during cleanup:', channel.id);
            try {
              await channel.delete('Cleanup - empty channel');
              await deleteTempVC(channel.id);
              await auditLog(guild, 'temp_vc_deleted', channel.id, 'system', {
                reason: 'cleanup_empty',
              });
            } catch (deleteError) {
              logger.error('[TempVoice] Error deleting empty channel during cleanup:', deleteError);
            }
          }
        } catch (vcError) {
          logger.error('[TempVoice] Error processing temp VC during cleanup:', vcError);
        }
      }
    } catch (error) {
      logger.error('[TempVoice] Error cleaning up guild:', error);
    }
  }

  /**
   * Force cleanup a specific channel
   */
  async forceCleanupChannel(channelId: string): Promise<void> {
    try {
      const tempVC = await getTempVCByChannelId(channelId);
      if (!tempVC) {
        logger.warn('[TempVoice] Temp VC record not found for force cleanup:', channelId);
        return;
      }

      const guild = this.client.guilds.cache.get(tempVC.guildId);
      if (!guild) {
        logger.warn('[TempVoice] Guild not found for force cleanup:', tempVC.guildId);
        await deleteTempVC(channelId);
        return;
      }

      const channel = guild.channels.cache.get(channelId);
      if (channel && channel instanceof VoiceChannel) {
        try {
          await channel.delete('Force cleanup by staff');
          await auditLog(guild, 'temp_vc_force_deleted', channelId, 'system');
          logger.info('[TempVoice] Force deleted temp VC:', channelId);
        } catch (deleteError) {
          logger.error('[TempVoice] Error force deleting channel:', deleteError);
        }
      }

      await deleteTempVC(channelId);
    } catch (error) {
      logger.error('[TempVoice] Error force cleaning up channel:', error);
      throw error;
    }
  }
}
