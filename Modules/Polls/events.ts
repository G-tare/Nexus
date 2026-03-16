import { ModuleEvent } from '../../Shared/src/types/command';
import {  Events, MessageFlags } from 'discord.js';
import { cache } from '../../Shared/src/cache/cacheManager';
import { eventBus } from '../../Shared/src/events/eventBus';
import {
  getPoll,
  castVote,
  removeVote,
  buildPollContainer,
  buildResultsContainer,
  endPoll,
} from './helpers';

export const pollsEvents: ModuleEvent[] = [
  { event: Events.InteractionCreate,
    once: false,
    handler: async (interaction) => {
      if (!interaction.isButton()) return;
      if (!interaction.customId.startsWith('poll_vote_')) return;

      const client = interaction.client;

      try {
        const parts = interaction.customId.split('_');
        const pollId = parts[2];
        const optionIndex = parseInt(parts[3]);

        const poll = await getPoll(pollId, cache);
        if (!poll) {
          return await interaction.reply({
            content: '❌ Poll not found.',
            flags: MessageFlags.Ephemeral,
          });
        }

        if (poll.status === 'ended') {
          return await interaction.reply({
            content: '❌ This poll has ended.',
            flags: MessageFlags.Ephemeral,
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
            cache
          );
          if (!removeResult.success) {
            return await interaction.reply({
              content: `❌ ${removeResult.reason}`,
              flags: MessageFlags.Ephemeral,
            });
          }

          await interaction.reply({
            content: `✅ Your vote for **${poll.options[optionIndex]}** has been removed.`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          // Add the vote
          const voteResult = await castVote(
            pollId,
            interaction.user.id,
            optionIndex,
            cache
          );
          if (!voteResult.success) {
            return await interaction.reply({
              content: `❌ ${voteResult.reason}`,
              flags: MessageFlags.Ephemeral,
            });
          }

          await interaction.reply({
            content: `✅ Your vote for **${poll.options[optionIndex]}** has been recorded.`,
            flags: MessageFlags.Ephemeral,
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
                const updatedPoll = await getPoll(pollId, cache);
                if (updatedPoll) {
                  const updatedContainer = buildPollContainer(updatedPoll, true);
                  const pollComponents = message.components.filter((row: any) =>
                    row.components.some((c: any) => c.customId?.startsWith('poll_vote_'))
                  );
                  await message.edit({ components: [updatedContainer, ...pollComponents] });
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
            flags: MessageFlags.Ephemeral,
          });
        } catch {
          // Interaction already replied
        }
      }
    },
  },
];

export async function pollEndChecker(client: any) {
  setInterval(async () => {
    try {
      // Cache doesn't expose a keys() method like Redis, so we cannot enumerate all polls.
      // In production, you should store a separate index of active poll IDs or use a database lookup.
      // For now, this checker will be a no-op placeholder.
      // TODO: Implement proper poll expiration using database or a maintained index
      return;

    } catch (error) {
      console.error('Error in poll end checker:', error);
    }
  }, 30000); // Check every 30 seconds
}
