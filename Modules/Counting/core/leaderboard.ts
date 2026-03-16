import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getServerLeaderboard,
  getGlobalHighestCounts,
  getStreakLeaderboard,
  LeaderboardEntry,
} from '../helpers';
import {
  moduleContainer,
  addText,
  addFields,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';

const command = new SlashCommandBuilder()
  .setName('counting-leaderboard')
  .setDescription('View counting leaderboards')
  .addSubcommand((sub) =>
    sub
      .setName('top-counters')
      .setDescription('View the top counters on this server (most correct counts)')
  )
  .addSubcommand((sub) =>
    sub
      .setName('highest-numbers')
      .setDescription('View the highest numbers reached on this server')
  )
  .addSubcommand((sub) =>
    sub
      .setName('streaks')
      .setDescription('View the highest counting streaks on this server')
  )
  .addSubcommand((sub) =>
    sub
      .setName('global')
      .setDescription('View the global highest numbers across all servers')
  );

const leaderboardCommand: BotCommand = {
  data: command,
  module: 'counting',
  permissionPath: 'counting.counting-leaderboard',
  premium: false,
  category: 'engagement',
  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const subcommand = interaction.options.getSubcommand();

    try {
      let entries: LeaderboardEntry[] = [];
      let title = '';
      let description = '';

      if (subcommand === 'top-counters') {
        entries = await getServerLeaderboard(guildId, 'counts');
        title = '🏆 Top Counters';
        description = 'Users with the most successful counts';
      } else if (subcommand === 'highest-numbers') {
        entries = await getServerLeaderboard(guildId, 'highest');
        title = '📊 Highest Numbers Reached';
        description = 'Highest individual numbers counted';
      } else if (subcommand === 'streaks') {
        entries = await getStreakLeaderboard(guildId);
        title = '🔥 Highest Streaks';
        description = 'Longest consecutive correct counts';
      } else if (subcommand === 'global') {
        entries = await getGlobalHighestCounts();
        title = '🌍 Global Highest Numbers';
        description = 'Highest server records across all servers';
      }

      if (entries.length === 0) {
        const container = moduleContainer('counting');
        addText(container, `### ${title}`);
        addText(container, 'No data available yet.');

        return interaction.reply(v2Payload([container]));
      }

      // Format leaderboard entries
      const medals = ['🥇', '🥈', '🥉'];
      const formattedEntries: string[] = [];

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const medal = i < 3 ? medals[i] : `${i + 1}.`;
        let displayName = entry.username;

        if (subcommand !== 'global') {
          // For server leaderboards, fetch user info
          try {
            const user = await interaction.client.users.fetch(entry.userId);
            displayName = user.username;
          } catch {
            displayName = `User ${entry.userId}`;
          }
        }

        formattedEntries.push(`${medal} **${displayName}** - ${entry.value}`);
      }

      const container = moduleContainer('counting');
      addText(container, `### ${title}\n${description}`);
      addFields(container, [{ name: 'Ranking', value: formattedEntries.join('\n'), inline: false }]);

      return interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('[Counting] Error in /counting-leaderboard:', error);
      return interaction.reply({
        content: 'An error occurred while fetching the leaderboard.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default leaderboardCommand;
