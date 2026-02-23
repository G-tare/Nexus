import { Client, Events, Message, GuildMember } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import {
  getWelcomeConfig,
  sendWelcomeMessage,
  sendLeaveMessage,
  sendWelcomeDm,
  assignAutoroles,
  checkJoinGate,
  markFirstMessage,
  replacePlaceholders,
} from './helpers';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('Welcome:Events');

/**
 * Handle new member joins
 * - Check join gate (kick/quarantine if account too young)
 * - Send welcome message
 * - Send welcome DM
 * - Assign autoroles
 */
async function memberJoinHandler(member: GuildMember) {
  try {
    const config = await getWelcomeConfig(member.guild.id);
    if (!config) return;

    // Check join gate first
    if (config.joingate?.enabled) {
      const gateResult = await checkJoinGate(member, config);
      if ((gateResult as any).blocked) {
        logger.info(
          `Join gate blocked member ${member.id} in ${member.guild.id}`,
          { action: (gateResult as any).action }
        );
        return;
      }
    }

    // Send welcome message
    if (config.welcome?.enabled) {
      await sendWelcomeMessage(member, config);
    }

    // Send welcome DM
    if (config.dm?.enabled) {
      await sendWelcomeDm(member, config);
    }

    // Assign autoroles
    if (config.autorole?.enabled) {
      await assignAutoroles(member, config);
    }
  } catch (error) {
    logger.error(`Error in memberJoinHandler for ${member.id}:`, error);
  }
}

/**
 * Handle member leaves
 * - Send leave message if enabled
 */
async function memberLeaveHandler(member: GuildMember) {
  try {
    const config = await getWelcomeConfig(member.guild.id);
    if (!config) return;

    if (config.leave?.enabled) {
      await sendLeaveMessage(member, config);
    }
  } catch (error) {
    logger.error(`Error in memberLeaveHandler for ${member.id}:`, error);
  }
}

/**
 * Handle first message greeter
 * - Detect first message from new members
 * - Send greeting with placeholders replaced
 * - Auto-delete after 30 seconds
 */
async function firstMessageGreetHandler(message: Message) {
  try {
    // Skip bots and DMs
    if (message.author.bot || !message.guild) return;

    const config = await getWelcomeConfig(message.guild.id);
    if (!config || !config.greet?.enabled) return;

    const member = message.member;
    if (!member || !message.guildId) return;

    // Check if this is their first message
    const isFirstMessage = await markFirstMessage(message.guildId, member.id);
    if (!isFirstMessage) return;

    // Replace placeholders
    let greetMessage = config.greet.message;
    greetMessage = replacePlaceholders(greetMessage, member);

    // Send to greet channel or current channel
    const targetChannel = config.greet.channelId
      ? message.guild.channels.cache.get(config.greet.channelId)
      : message.channel;

    if (targetChannel && targetChannel.isTextBased()) {
      const sentMessage = await (targetChannel as any).send(greetMessage);

      // Auto-delete after 30 seconds
      setTimeout(() => {
        sentMessage.delete().catch(() => {
          // Message may have already been deleted
        });
      }, 30000);
    }
  } catch (error) {
    logger.error('Error in firstMessageGreetHandler:', error);
  }
}

export const welcomeEvents: ModuleEvent[] = [
  { event: Events.GuildMemberAdd,
    once: false,
    async handler(member: GuildMember) {
      await memberJoinHandler(member);
    },
  },
  { event: Events.GuildMemberRemove,
    once: false,
    async handler(member: GuildMember) {
      await memberLeaveHandler(member);
    },
  },
  { event: Events.MessageCreate,
    once: false,
    async handler(message: Message) {
      await firstMessageGreetHandler(message);
    },
  },
];
