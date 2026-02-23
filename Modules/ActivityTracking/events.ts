import { Events, VoiceState, Message, MessageReaction, User } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import {
  getActivityConfig,
  startVoiceSession,
  endVoiceSession,
  incrementMessageActivity,
  incrementReactionActivity,
} from './helpers';

const logger = createModuleLogger('ActivityTracking');

const voiceStateUpdate: ModuleEvent = { event: Events.VoiceStateUpdate,
  handler: async (oldState: VoiceState, newState: VoiceState) => {
    const guildId = newState.guild.id;
    const userId = newState.member?.id;

    if (!userId) return;

    try {
      const config = await getActivityConfig(guildId);
      if (!config.enabled || !config.trackVoice) return;

      const memberRoles = newState.member?.roles.cache.map((r) => r.id) || [];
      if (memberRoles.some((roleId) => config.excludedRoles.includes(roleId))) return;

      // User left voice channel
      if (oldState.channelId && !newState.channelId) {
        await endVoiceSession(guildId, userId);
        return;
      }

      // User joined voice channel
      if (!oldState.channelId && newState.channelId) {
        if (!config.excludedChannels.includes(newState.channelId)) {
          await startVoiceSession(guildId, userId, newState.channelId);
        }
        return;
      }

      // User switched channels
      if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        await endVoiceSession(guildId, userId);
        if (!config.excludedChannels.includes(newState.channelId)) {
          await startVoiceSession(guildId, userId, newState.channelId);
        }
      }
    } catch (error) {
      logger.error(`Error in VoiceStateUpdate handler:`, error);
    }
  },
};

const messageCreate: ModuleEvent = { event: Events.MessageCreate,
  handler: async (message: Message) => {
    if (message.author.bot || !message.guild) return;

    try {
      const config = await getActivityConfig(message.guild.id);
      if (!config.enabled || !config.trackMessages) return;

      if (config.excludedChannels.includes(message.channelId)) return;

      const memberRoles = message.member?.roles.cache.map((r) => r.id) || [];
      if (memberRoles.some((roleId) => config.excludedRoles.includes(roleId))) return;

      await incrementMessageActivity(message.guild.id, message.author.id);
    } catch (error) {
      logger.error(`Error in MessageCreate handler:`, error);
    }
  },
};

const messageReactionAdd: ModuleEvent = { event: Events.MessageReactionAdd,
  handler: async (reaction: MessageReaction, user: User) => {
    if (user.bot) return;

    try {
      const message = await reaction.message.fetch();
      if (!message.guild) return;

      const config = await getActivityConfig(message.guild.id);
      if (!config.enabled || !config.trackReactions) return;

      if (config.excludedChannels.includes(message.channelId)) return;

      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      const memberRoles = member.roles.cache.map((r) => r.id);
      if (memberRoles.some((roleId) => config.excludedRoles.includes(roleId))) return;

      await incrementReactionActivity(message.guild.id, user.id);
    } catch (error) {
      logger.error(`Error in MessageReactionAdd handler:`, error);
    }
  },
};

export const activityEvents: ModuleEvent[] = [voiceStateUpdate, messageCreate, messageReactionAdd];
