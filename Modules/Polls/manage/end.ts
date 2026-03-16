import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getPoll,
  endPoll,
  buildResultsContainer,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('pollend')
    .setDescription('End a poll early and show final results')
    .addStringOption((option) =>
      option
        .setName('id')
        .setDescription('The poll ID to end')
        .setRequired(true)
    ),

  execute: async (interaction: ChatInputCommandInteraction, deps: any) => {
    const { redis, client } = deps;

    await interaction.deferReply({});

    try {
      const pollId = interaction.options.getString('id', true);

      // Get the poll
      const poll = await getPoll(pollId, redis);
      if (!poll) {
        return await interaction.editReply({
          content: '❌ Poll not found.',
        });
      }

      // Check permissions - creator or ManageGuild
      const hasPermission =
        poll.creatorId === interaction.user.id ||
        interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

      if (!hasPermission) {
        return await interaction.editReply({
          content: '❌ You do not have permission to end this poll. Only the creator or server administrators can end it.',
        });
      }

      // End the poll
      const result = await endPoll(pollId, redis);
      if (!result.success) {
        return await interaction.editReply({
          content: `❌ ${result.reason || 'Could not end poll'}`,
        });
      }

      // Build and send results container
      const resultsContainer = buildResultsContainer(result.poll!);

      await interaction.editReply({
        components: [resultsContainer],
      });

      // Try to edit the original message with final results
      try {
        const channel = await client.channels.fetch(poll.channelId);
        if (channel && channel.isTextBased()) {
          const message = await channel.messages.fetch(poll.messageId);
          if (message) {
            await message.edit({
              components: [resultsContainer], // Remove buttons
            });
          }
        }
      } catch (error) {
        console.error('Failed to update poll message:', error);
      }
    } catch (error) {
      console.error('Error in /pollend command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while ending the poll.',
      });
    }
  },

  module: 'polls',
  permissionPath: 'polls.pollend',
  premiumFeature: 'polls.basic',
};

export default command;
