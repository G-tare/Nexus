import { Events, MessageReaction, User, TextChannel, PartialUser } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { eventBus } from '../../Shared/src/events/eventBus';
import {
  getBoardConfig,
  findBoardByEmoji,
  getBoardMessage,
  addToBoardChannel,
  updateBoardMessage,
  removeBoardMessage,
} from './helpers';

export const quoteBoardEvents: ModuleEvent[] = [
  { event: Events.MessageReactionAdd,
    once: false,
    handler: async (reaction: MessageReaction, user: User | PartialUser) => {
      try {
        // Skip if bot reaction
        if (user.bot) {
          return;
        }

        // Fetch full reaction if partial
        if (reaction.partial) {
          await reaction.fetch();
        }

        // Fetch full message if partial
        let message = reaction.message;
        if (message.partial) {
          message = await message.fetch();
        }

        // Check if guild
        if (!message.guild) {
          return;
        }

        // Get board config
        const config = await getBoardConfig(message.guildId!);
        if (!config.enabled) {
          return;
        }

        // Find matching board
        const emoji = reaction.emoji.toString();
        const board = findBoardByEmoji(config, emoji);
        if (!board) {
          return;
        }

        // Check if board channel exists and is configured
        if (!board.channelId) {
          return;
        }

        try {
          const boardChannel = await message.guild.channels.fetch(board.channelId);
          if (!boardChannel || !boardChannel.isTextBased()) {
            return;
          }
        } catch {
          return;
        }

        // Check if message channel is ignored
        if (board.ignoredChannels.includes(message.channelId)) {
          return;
        }

        // Check if message author has ignored role
        if (message.member && board.ignoredRoles.length > 0) {
          const hasIgnoredRole = board.ignoredRoles.some((roleId) =>
            message.member!.roles.cache.has(roleId)
          );
          if (hasIgnoredRole) {
            return;
          }
        }

        // Check self-react
        if (!board.selfReact && message.author.id === user.id) {
          return;
        }

        // Check NSFW
        if (!board.nsfw && (message.channel as TextChannel).nsfw) {
          return;
        }

        // Count reactions
        const reactionCount = reaction.count || 1;

        // Check if already on board
        const existingBoardMessage = await getBoardMessage(
          message.guildId!,
          message.id,
          board.id
        );

        if (existingBoardMessage) {
          // Update existing
          if (reactionCount >= board.threshold) {
            await updateBoardMessage(message.guild, board, existingBoardMessage, reactionCount);
          }
        } else {
          // Add to board if threshold met
          if (reactionCount >= board.threshold) {
            await addToBoardChannel(message.guild, board, message, reactionCount);
          }
        }
      } catch (error) {
        console.error('Error in reaction add handler:', error);
      }
    },
  },
  { event: Events.MessageReactionRemove,
    once: false,
    handler: async (reaction: MessageReaction, user: User | PartialUser) => {
      try {
        // Skip if bot reaction
        if (user.bot) {
          return;
        }

        // Fetch full reaction if partial
        if (reaction.partial) {
          await reaction.fetch();
        }

        // Fetch full message if partial
        let message = reaction.message;
        if (message.partial) {
          message = await message.fetch();
        }

        // Check if guild
        if (!message.guild) {
          return;
        }

        // Get board config
        const config = await getBoardConfig(message.guildId!);
        if (!config.enabled) {
          return;
        }

        // Find matching board
        const emoji = reaction.emoji.toString();
        const board = findBoardByEmoji(config, emoji);
        if (!board) {
          return;
        }

        // Check if board channel exists and is configured
        if (!board.channelId) {
          return;
        }

        // Check if message is on board
        const boardMessage = await getBoardMessage(
          message.guildId!,
          message.id,
          board.id
        );

        if (!boardMessage) {
          return;
        }

        // Count remaining reactions
        const reactionCount = reaction.count || 0;

        if (reactionCount >= board.threshold) {
          // Update with new count
          await updateBoardMessage(message.guild, board, boardMessage, reactionCount);
        } else {
          // Remove from board
          await removeBoardMessage(message.guild, board, boardMessage);
        }
      } catch (error) {
        console.error('Error in reaction remove handler:', error);
      }
    },
  },
];
