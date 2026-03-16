import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  LeaderboardType,
  fetchLeaderboard,
  getUserRank,
  buildLeaderboardText,
  getLeaderboardConfig,
  isValidLeaderboardType,
  getLeaderboardTypeDisplay
} from '../helpers';


const command: BotCommand = {
  module: 'leaderboards',
  permissionPath: 'leaderboards.view',
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('Quick view of top members in a specific stat')
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

      // Fetch leaderboard data (always page 1, default limit)
      const limit = Math.min(config.entriesPerPage, 10); // Cap at 10 for top command
      const entries = await fetchLeaderboard(guildId, type, {
        page: 1,
        limit,
        days: days || undefined
      });

      if (entries.length === 0) {
        await interaction.editReply('No data available for this leaderboard.');
        return;
      }

      // Get user's rank if enabled
      let userRank = null;
      if (config.showRankCard && entries.length < limit) {
        const user = interaction.user;
        userRank = await getUserRank(guildId, user.id, type, days || undefined);
      }

      // Build embed
      const text = buildLeaderboardText(
        entries,
        type,
        interaction.guild?.name || 'Unknown Server',
        1,
        1,
        userRank,
        days || undefined
      );

      await interaction.editReply({
        embeds: [{
          title: text.title,
          description: text.description,
          footer: { text: text.footer },
          color: 0x3498db
        }]
      });
    } catch (error) {
      console.error('Error in top command:', error);
      await interaction.editReply('An error occurred while fetching the leaderboard.');
    }
  }
};

export default command;
