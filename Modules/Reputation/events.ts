import { Events, MessageReaction, User, Client, PartialMessageReaction, PartialUser, Message } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { createModuleLogger } from '../../Shared/src/utils/logger';
import { eventBus } from '../../Shared/src/events/eventBus';
import {
  getRepConfig,
  adjustRep,
  canGiveRep,
  setRepCooldowns,
  updateRepRoles,
  processDecay,
} from './helpers';

const logger = createModuleLogger('Reputation:Events');

/**
 * Reaction-based reputation: upvote/downvote emojis on messages.
 */
const reactionRepHandler: ModuleEvent = { event: Events.MessageReactionAdd,
  async handler(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (user.bot) return;

    if (reaction.partial) {
      try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
      try { await reaction.message.fetch(); } catch { return; }
    }

    const message = reaction.message as Message;
    if (!message.guild) return;

    const config = await getRepConfig(message.guild.id);
    if (!config.reactionRepEnabled) return;

    const emoji = reaction.emoji.name || reaction.emoji.toString();
    let delta = 0;

    if (emoji === config.upvoteEmoji || reaction.emoji.toString() === config.upvoteEmoji) {
      delta = 1;
    } else if (emoji === config.downvoteEmoji || reaction.emoji.toString() === config.downvoteEmoji) {
      delta = -1;
    } else {
      return;
    }

    const targetId = message.author!.id;
    const giverId = user.id;

    // No self-rep
    if (!config.allowSelfRep && giverId === targetId) return;

    // Check cooldown
    const { allowed } = await canGiveRep(message.guild.id, giverId, targetId);
    if (!allowed) return;

    const { newRep } = await adjustRep(
      message.guild.id,
      targetId,
      delta,
      giverId,
      `Reaction ${delta > 0 ? 'upvote' : 'downvote'} on message`,
    );

    await setRepCooldowns(message.guild.id, giverId, targetId);
    await updateRepRoles(message.guild, targetId, newRep);
  },
};

/**
 * Listen for cross-module rep events from eventBus.
 * Other modules can emit 'giveReputation' events.
 */
const crossModuleRepHandler: ModuleEvent = { event: Events.ClientReady,
  once: true,
  async handler(client: Client) {
    eventBus.on('giveReputation', async (data: {
      guildId: string;
      fromUserId: string;
      toUserId: string;
      amount: number;
      delta?: number;
      givenBy?: string;
      reason?: string;
    }) => {
      try {
        const guild = client.guilds.cache.get(data.guildId);
        if (!guild) return;

        const { newRep } = await adjustRep(
          data.guildId,
          data.toUserId,
          data.delta || data.amount,
          data.givenBy || 'system',
          data.reason,
        );

        await updateRepRoles(guild, data.toUserId, newRep);
      } catch (err: any) {
        logger.error('Cross-module rep error', { error: err.message });
      }
    });

    logger.info('Cross-module reputation listener active');
  },
};

/**
 * Reputation decay scheduler.
 */
const decayScheduler: ModuleEvent = { event: Events.ClientReady,
  once: true,
  async handler(client: Client) {
    // Run decay once per hour
    setInterval(async () => {
      for (const guild of client.guilds.cache.values()) {
        try {
          const decayed = await processDecay(guild);
          if (decayed > 0) {
            logger.debug('Processed rep decay', { guild: guild.id, users: decayed });
          }
        } catch (err: any) {
          logger.error('Rep decay error', { guild: guild.id, error: err.message });
        }
      }
    }, 60 * 60 * 1000); // Every hour
  },
};

export const reputationEvents: ModuleEvent[] = [
  reactionRepHandler,
  crossModuleRepHandler,
  decayScheduler,
];
