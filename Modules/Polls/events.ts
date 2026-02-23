import { ModuleEvent } from '../../Shared/src/types/command';
import { Events } from 'discord.js';
import { getDb, getRedis } from '../../Shared/src/database/connection';
import { eventBus } from '../../Shared/src/events/eventBus';
import {
  getPoll,
  castVote,
  removeVote,
  buildPollEmbed,
  buildResultsEmbed,
  endPoll,
} from './helpers';

export const pollsEvents: ModuleEvent[] = [
  { event: Events.InteractionCreate,
    once: false,
    handler: async (interaction) => {
      if (!interaction.isButton()) return;
      if (!interaction.customId.startsWith('poll_vote_')) return;

      const client = interaction.client;
      const redis = getRedis();

      try {
        const parts = interaction.customId.split('_');
        const pollId = parts[2];
        const optionIndex = parseInt(parts[3]);

        const poll = await getPoll(pollId, redis);
        if (!poll) {
          return await interaction.reply({
            content: '❌ Poll not found.',
            ephemeral: true,
          });
        }

        if (poll.status === 'ended') {
          return await interaction.reply({
            content: '❌ This poll has ended.',
            ephemeral: true,
          });
        }

        // Check if user already voted on this option
        const userAlreadyVoted = poll.votes[optionIndex.toString()]?.includes(
          interaction.user.id
        );

        if (userAlreadyVoted) {
          // Remove the vote
          const removeResult = await removeVote(
            pollId,
            interaction.user.id,
            optionIndex,
            redis
          );
          if (!removeResult.success) {
            return await interaction.reply({
              content: `❌ ${removeResult.reason}`,
              ephemeral: true,
            });
          }

          await interaction.reply({
            content: `✅ Your vote for **${poll.options[optionIndex]}** has been removed.`,
            ephemeral: true,
          });
        } else {
          // Add the vote
          const voteResult = await castVote(
            pollId,
            interaction.user.id,
            optionIndex,
            redis
          );
          if (!voteResult.success) {
            return await interaction.reply({
              content: `❌ ${voteResult.reason}`,
              ephemeral: true,
            });
          }

          await interaction.reply({
            content: `✅ Your vote for **${poll.options[optionIndex]}** has been recorded.`,
            ephemeral: true,
          });
        }

        // Update the poll message if live results are enabled
        if (poll.showLiveResults && poll.status === 'active') {
          try {
            const channel = await client.channels.fetch(poll.channelId);
            if (channel && channel.isTextBased()) {
              const message = await channel.messages.fetch(poll.messageId);
              if (message) {
                // Get updated poll
                const updatedPoll = await getPoll(pollId, redis);
                if (updatedPoll) {
                  const updatedEmbed = buildPollEmbed(updatedPoll, true);
                  await message.edit({ embeds: [updatedEmbed] });
                }
              }
            }
          } catch (error) {
            console.error('Failed to update poll message:', error);
          }
        }
      } catch (error) {
        console.error('Error handling poll vote:', error);
        try {
          await interaction.reply({
            content: '❌ An error occurred while recording your vote.',
            ephemeral: true,
          });
        } catch {
          // Interaction already replied
        }
      }
    },
  },
];

export async function pollEndChecker(client: any) {
  const redis = getRedis();

  setInterval(async () => {
    try {
      // Get all guilds with polls
      const keys = await redis.keys('polls:guild:*');

      for (const key of keys) {
        const pollIds: string[] = await redis.smembers(key);

        for (const pollId of pollIds) {
          const poll = await getPoll(pollId, redis);
          if (!poll) continue;

          // Check if poll should end
          if (
            poll.status === 'active' &&
            poll.endsAt &&
            poll.endsAt.getTime() <= Date.now()
          ) {
            // End the poll
            const result = await endPoll(pollId, redis);

            if (result.success && result.poll) {
              // Try to update the original message
              try {
                const channel = await client.channels.fetch(result.poll.channelId);
                if (channel && channel.isTextBased()) {
                  const message = await channel.messages.fetch(result.poll.messageId);
                  if (message) {
                    const finalEmbed = buildResultsEmbed(result.poll);
                    await message.edit({
                      embeds: [finalEmbed],
                      components: [], // Remove buttons
                    });
                  }
                }
              } catch (error) {
                console.error('Failed to update ended poll message:', error);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in poll end checker:', error);
    }
  }, 30000); // Check every 30 seconds
}
