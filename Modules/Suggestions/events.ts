import { Message, Events } from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import { getSuggestionConfig } from './helpers';

export const suggestionsEvents: ModuleEvent[] = [
  {
    /**
     * MessageReactionAdd handler - Prevent double-voting on suggestion reactions
     * Removes duplicate reactions if a user tries to add the same reaction twice
     */
    event: Events.MessageReactionAdd,
    once: false,
    handler: async (reaction: any, user: any) => {
      try {
        // Ignore bot reactions
        if (user.bot) return;

        // Check if message is in a suggestions channel
        if (!reaction.message.guildId!) return;

        const config = await getSuggestionConfig(reaction.message.guildId!);
        if (!config.channelId || reaction.message.channelId !== config.channelId) {
          return;
        }

        const reactionEmoji = reaction.emoji.toString();

        // Check if this is a vote emoji
        if (reactionEmoji !== config.upvoteEmoji && reactionEmoji !== config.downvoteEmoji) {
          return;
        }

        // Check if user already has this reaction
        const userReactions = reaction.message.reactions.cache.filter(
          (r: any) => (r.emoji.toString() === config.upvoteEmoji || r.emoji.toString() === config.downvoteEmoji) && r.users.cache.has(user.id),
        );

        // If user has more than one vote reaction, remove duplicates
        if (userReactions.size > 1) {
          for (const r of userReactions.values()) {
            if (r.emoji.toString() !== reactionEmoji) {
              // Remove the other vote reaction
              await r.users.remove(user.id).catch(() => {});
            }
          }
        }
      } catch (error) {
        console.error('Error in suggestion reaction handler:', error);
      }
    },
  },
  {
    /**
     * MessageUpdate handler - Track suggestion edits if allowEditing is enabled
     * Note: Only logs the edit, doesn't modify the suggestion message
     */
    event: Events.MessageUpdate,
    once: false,
    handler: async (oldMessage: Message, newMessage: Message) => {
      try {
        // Ignore bot messages
        if (newMessage.author?.bot) return;

        // Check if message is in a suggestions channel
        if (!newMessage.guildId) return;

        const config = await getSuggestionConfig(newMessage.guildId);
        if (!config.channelId || newMessage.channelId !== config.channelId) {
          return;
        }

        if (!config.allowEditing) return;

        // Log that the message was edited
        if (oldMessage.content !== newMessage.content) {
          console.log(
            `Suggestion message in ${newMessage.guildId} was edited by ${newMessage.author?.tag}`,
          );
        }
      } catch (error) {
        console.error('Error in suggestion edit handler:', error);
      }
    },
  },
];
