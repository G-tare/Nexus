import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getActivityLeaderboard, formatDuration } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, addText, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('ActivityTracking');

type PeriodType = 'week' | 'month' | 'all';

const PERIOD_DAYS: Record<PeriodType, number> = {
  week: 7,
  month: 30,
  all: 365,
};

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('activityleaderboard')
    .setDescription('View the activity leaderboard for this server')
    .addStringOption((option) =>
      option
        .setName('period')
        .setDescription('Time period to check (default: month)')
        .setRequired(false)
        .addChoices(
          { name: 'This Week', value: 'week' },
          { name: 'This Month', value: 'month' },
          { name: 'All Time', value: 'all' }
        )
    ),

  module: 'activitytracking',
  permissionPath: 'activitytracking.activityleaderboard',
  cooldown: 5,

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      if (!interaction.guild) {
        await interaction.reply({
          content: 'This command can only be used in a server.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const period = (interaction.options.getString('period') || 'month') as PeriodType;
      const days = PERIOD_DAYS[period];

      await interaction.deferReply();

      const leaderboard = await getActivityLeaderboard(interaction.guild.id, 10, days);

      if (leaderboard.length === 0) {
        await interaction.editReply({ content: 'No activity data available for this period.' });
        return;
      }

      // Fetch usernames for all entries
      const entries = await Promise.all(
        leaderboard.map(async (entry, index) => {
          try {
            const user = await interaction.client.users.fetch(entry.userId);
            return { rank: index + 1, username: user.username, ...entry };
          } catch {
            return { rank: index + 1, username: 'Unknown User', ...entry };
          }
        })
      );

      const periodLabel = period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'All Time';

      const description = entries
        .map(
          (entry) =>
            `**${entry.rank}.** ${entry.username}\n` +
            `Score: \`${entry.score}\` | Voice: \`${formatDuration(entry.voiceMinutes)}\` | Messages: \`${entry.messages}\` | Reactions: \`${entry.reactions}\``
        )
        .join('\n\n');

      const container = moduleContainer('activity_tracking');
      addText(container, `### 🏆 Activity Leaderboard - ${periodLabel}`);
      addText(container, description);
      addFooter(container, `Showing top ${entries.length} members`);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      logger.error('Error executing activity leaderboard command', error);
      if (interaction.deferred) {
        await interaction.editReply({ content: 'An error occurred while fetching leaderboard data.' });
      } else {
        await interaction.reply({ content: 'An error occurred while fetching leaderboard data.', flags: MessageFlags.Ephemeral });
      }
    }
  },
};

export default command;
