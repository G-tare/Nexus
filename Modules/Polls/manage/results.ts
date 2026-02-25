import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getPoll,
  buildResultsEmbed,
  buildPollEmbed,
} from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('pollresults')
    .setDescription('View the current results of a poll')
    .addStringOption((option) =>
      option
        .setName('id')
        .setDescription('The poll ID')
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

      // Check permissions - creator, ManageMessages, or if showLiveResults is enabled
      const hasPermission =
        poll.creatorId === interaction.user.id ||
        interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) ||
        poll.showLiveResults;

      if (!hasPermission) {
        return await interaction.editReply({
          content: '❌ You do not have permission to view these results. The poll results are hidden until it ends.',
        });
      }

      // Build embed
      let embed;
      if (poll.status === 'ended') {
        embed = buildResultsEmbed(poll);
      } else {
        embed = buildPollEmbed(poll, true); // Always show live results in this view
      }

      await interaction.editReply({
        embeds: [embed],
      });
    } catch (error) {
      console.error('Error in /pollresults command:', error);
      await interaction.editReply({
        content: '❌ An error occurred while retrieving poll results.',
      });
    }
  },

  module: 'polls',
  permissionPath: 'polls.pollresults',
  premiumFeature: 'polls.basic',
};

export default command;
