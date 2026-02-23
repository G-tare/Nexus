import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  LeaderboardType,
  fetchLeaderboard,
  getUserRank,
  buildLeaderboardEmbed,
  getLeaderboardConfig,
  isValidLeaderboardType,
  getLeaderboardTypeDisplay
} from '../helpers';


const command: BotCommand = {
  module: 'leaderboards',
  permissionPath: 'leaderboards.view',
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the server leaderboard for various stats')
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Type of leaderboard to display')
        .setRequired(true)
        .addChoices(
          { name: 'Experience (XP)', value: 'xp' },
          { name: 'Level', value: 'level' },
          { name: 'Currency', value: 'currency' },
          { name: 'Messages', value: 'messages' },
          { name: 'Invites', value: 'invites' },
          { name: 'Voice Time', value: 'voice' },
          { name: 'Reputation', value: 'reputation' },
          { name: 'Counting Game', value: 'counting' }
        )
    )
    .addIntegerOption(option =>
      option
        .setName('page')
        .setDescription('Page number (default: 1)')
        .setRequired(false)
        .setMinValue(1)
    )
    .addIntegerOption(option =>
      option
        .setName('days')
        .setDescription('Filter to last X days (for competitions/events)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(365)
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    try {
      const guildId = interaction.guildId!;
      if (!guildId) {
        await interaction.editReply('This command can only be used in a server.');
        return;
      }

      // Get leaderboard configuration
      const config = await getLeaderboardConfig(guildId);

      // Get command options
      const typeStr = interaction.options.getString('type', true);
      const page = interaction.options.getInteger('page') || 1;
      const days = interaction.options.getInteger('days');

      // Validate type
      if (!isValidLeaderboardType(typeStr)) {
        await interaction.editReply('Invalid leaderboard type.');
        return;
      }

      const type: LeaderboardType = typeStr;

      // Check if this type is enabled
      if (!config.enabledTypes.includes(type)) {
        await interaction.editReply(`The ${getLeaderboardTypeDisplay(type).displayName} leaderboard is disabled.`);
        return;
      }

      // Fetch leaderboard data
      const limit = config.entriesPerPage;
      const entries = await fetchLeaderboard(guildId, type, {
        page,
        limit,
        days: days || undefined
      });

      if (entries.length === 0) {
        await interaction.editReply('No data available for this leaderboard.');
        return;
      }

      // Calculate total pages (estimate - would need total count in real implementation)
      const totalPages = Math.max(1, Math.ceil(entries.length / limit));

      // Get user's rank if enabled and not in current page
      let userRank = null;
      if (config.showRankCard) {
        const user = interaction.user;
        userRank = await getUserRank(guildId, user.id, type, days || undefined);
      }

      // Build embed
      const embed = buildLeaderboardEmbed(
        entries,
        type,
        interaction.guild?.name || 'Unknown Server',
        page,
        totalPages,
        userRank,
        days || undefined
      );

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in leaderboard command:', error);
      await interaction.editReply('An error occurred while fetching the leaderboard.');
    }
  }
};

export default command;
