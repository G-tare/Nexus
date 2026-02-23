import { ModuleEvent } from '../../Shared/src/types/command';
import { Events, VoiceState, VoiceChannel, ChannelType, AuditLogEvent } from 'discord.js';
import { createModuleLogger } from '../../Shared/src/utils/logger';
const logger = createModuleLogger('TempVoice');
import {
  getConfig,
  getTempVCByChannelId,
  getUserTempVC,
  createTempVC,
  deleteTempVC,
  formatChannelName,
  scheduleDeletion,
  cancelDeletion,
  isUserBanned,
  auditLog,
  setCooldown,
  scheduleInactivityTimeout,
  cancelInactivityTimeout,
  getGuildTempVCs,
} from './helpers';

/**
 * Handle user joining a channel
 */
async function handleUserJoined(
  voiceState: VoiceState,
  config: any,
  creatorChannelId: string,
  categoryId: string
): Promise<void> {
  try {
    const channel = voiceState.channel as VoiceChannel;
    const user = voiceState.member?.user;
    if (!channel || !user) return;

    // Check if user joined the creator channel
    if (channel.id === creatorChannelId) {
      await handleCreatorChannelJoin(voiceState, config, categoryId);
      return;
    }

    // Check if user joined an existing temp VC
    const tempVC = await getTempVCByChannelId(channel.id);
    if (tempVC) {
      // Cancel any deletion schedule when user joins
      cancelDeletion(channel.id);
      cancelInactivityTimeout(channel.id);

      // Start inactivity timer if configured
      if (config.inactivityTimeout > 0) {
        scheduleInactivityTimeout(
          channel.id,
          config.inactivityTimeout * 60 * 1000,
          async () => {
            try {
              logger.info('[TempVoice] Inactivity timeout for channel:', channel.id);
              await channel.delete('Inactivity timeout');
              await deleteTempVC(channel.id);
              await auditLog(voiceState.guild, 'inactivity_delete', channel.id, 'system');
            } catch (error) {
              logger.error('[TempVoice] Error deleting inactive channel:', error);
            }
          }
        );
      }

      logger.info('[TempVoice] User joined temp VC:', channel.id);
    }
  } catch (error) {
    logger.error('[TempVoice] Error handling user join:', error);
  }
}

/**
 * Handle user joining the creator channel
 */
async function handleCreatorChannelJoin(
  voiceState: VoiceState,
  config: any,
  categoryId: string
): Promise<void> {
  try {
    const guild = voiceState.guild;
    const user = voiceState.member?.user;
    const member = voiceState.member;
    if (!guild || !user || !member) return;

    // Check if user is banned
    if (await isUserBanned(guild, user.id)) {
      logger.info('[TempVoice] Banned user tried to create VC:', user.id);
      try {
        await member.voice.disconnect('You are banned from creating temp VCs');
      } catch (error) {
        logger.error('[TempVoice] Error disconnecting banned user:', error);
      }
      return;
    }

    // Check if user already has a temp VC
    const existingVC = await getUserTempVC(guild.id, user.id);
    if (existingVC) {
      logger.info('[TempVoice] User already has a temp VC:', user.id);
      return;
    }

    // Check max temp VCs in guild
    const guildVCs = await getGuildTempVCs(guild.id);
    if (guildVCs.length >= config.maxVCs) {
      logger.info('[TempVoice] Max temp VCs reached for guild:', guild.id);
      try {
        await member.voice.disconnect('Max temp voice channels reached');
      } catch (error) {
        logger.error('[TempVoice] Error disconnecting user:', error);
      }
      return;
    }

    // Create new temp VC
    const newChannelName = formatChannelName(config.nameTemplate, user);
    const category = guild.channels.cache.get(categoryId);
    const isCategory = category && category.type === ChannelType.GuildCategory;

    const newChannel = await guild.channels.create({ name: newChannelName,
      type: ChannelType.GuildVoice,
      parent: isCategory ? (category as any) : undefined,
      bitrate: config.bitrate,
      userLimit: config.defaultUserLimit || 0,
    }) as VoiceChannel;

    // Move user to new channel
    await member.voice.setChannel(newChannel);

    // Create database record
    await createTempVC({
      id: `${guild.id}-${newChannel.id}`,
      guildId: guild.id,
      channelId: newChannel.id,
      ownerId: user.id,
      createdAt: new Date(),
      lockedBy: [],
      permittedUsers: [],
      deniedUsers: [],
    });

    // Set cooldown
    setCooldown(user.id, config.cooldownSeconds);

    // Start inactivity timer if configured
    if (config.inactivityTimeout > 0) {
      scheduleInactivityTimeout(
        newChannel.id,
        config.inactivityTimeout * 60 * 1000,
        async () => {
          try {
            logger.info('[TempVoice] Inactivity timeout for new channel:', newChannel.id);
            await newChannel.delete('Inactivity timeout');
            await deleteTempVC(newChannel.id);
            await auditLog(guild, 'inactivity_delete', newChannel.id, 'system');
          } catch (error) {
            logger.error('[TempVoice] Error deleting inactive channel:', error);
          }
        }
      );
    }

    await auditLog(guild, 'temp_vc_created', newChannel.id, user.id, { name: newChannelName,
    });

    logger.info('[TempVoice] Created temp VC:', newChannel.id, 'for user:', user.id);
  } catch (error) {
    logger.error('[TempVoice] Error handling creator channel join:', error);
  }
}

/**
 * Handle user leaving a channel
 */
async function handleUserLeft(
  voiceState: VoiceState,
  config: any
): Promise<void> {
  try {
    const channel = voiceState.channel as VoiceChannel;
    if (!channel) return;

    // Check if this is a temp VC
    const tempVC = await getTempVCByChannelId(channel.id);
    if (!tempVC) return;

    // Check if channel is now empty
    const members = await channel.members;
    if (members.size === 0) {
      // Schedule deletion
      scheduleDeletion(
        channel.id,
        config.deleteAfterEmpty * 1000,
        async () => {
          try {
            logger.info('[TempVoice] Deleting empty temp VC:', channel.id);
            await channel.delete('Empty for configured duration');
            await deleteTempVC(channel.id);
            await auditLog(channel.guild, 'temp_vc_deleted', channel.id, 'system', {
              reason: 'empty',
            });
          } catch (error) {
            logger.error('[TempVoice] Error deleting empty channel:', error);
          }
        }
      );

      logger.info('[TempVoice] Scheduled deletion for empty channel:', channel.id);
    }

    // Cancel inactivity timeout since channel has activity (someone left)
    cancelInactivityTimeout(channel.id);
  } catch (error) {
    logger.error('[TempVoice] Error handling user left:', error);
  }
}

/**
 * Handle user switching channels
 */
async function handleUserSwitched(
  oldState: VoiceState,
  newState: VoiceState,
  config: any,
  creatorChannelId: string,
  categoryId: string
): Promise<void> {
  try {
    // Treat as leaving old channel then joining new channel
    await handleUserLeft(oldState, config);
    await handleUserJoined(newState, config, creatorChannelId, categoryId);
  } catch (error) {
    logger.error('[TempVoice] Error handling channel switch:', error);
  }
}

/**
 * Handle voice state updates (joins, leaves, switches)
 */
async function handleany(
  oldState: VoiceState,
  newState: VoiceState
): Promise<void> {
  try {
    const guild = newState.guild;
    if (!guild) return;

    const config = await getConfig(guild);
    if (!config.enabled || !config.creatorChannelId || !config.categoryId) {
      return;
    }

    const userId = newState.member?.id;
    if (!userId) return;

    const creatorChannelId = config.creatorChannelId;
    const categoryId = config.categoryId;

    // User joined a channel
    if (!oldState.channelId && newState.channelId) {
      await handleUserJoined(newState, config, creatorChannelId, categoryId);
    }
    // User left a channel
    else if (oldState.channelId && !newState.channelId) {
      await handleUserLeft(oldState, config);
    }
    // User switched channels
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      await handleUserSwitched(oldState, newState, config, creatorChannelId, categoryId);
    }
  } catch (error) {
    logger.error('[TempVoice] Error handling voice state update:', error);
  }
}

export const tempVoiceEvents: ModuleEvent[] = [
  { event: Events.VoiceStateUpdate,
    once: false,
    handler: handleany,
  },
];
