import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  User,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getUserStats, getUserCountingLives } from '../helpers';

const command = new SlashCommandBuilder()
  .setName('counting-stats')
  .setDescription('View counting statistics for a user')
  .addUserOption(
    (option) =>
      option
        .setName('user')
        .setDescription('The user to check stats for (defaults to you)')
        .setRequired(false)
  );

const statsCommand: BotCommand = {
  data: command,
  module: 'counting',
  permissionPath: 'counting.counting-stats',
  premium: false,
  category: 'engagement',
  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const targetUser = interaction.options.getUser('user') || interaction.user;

    try {
      const stats = await getUserStats(guildId, targetUser.id);
      const lives = await getUserCountingLives(guildId, targetUser.id);

      const totalAttempts = stats.correctCounts + stats.wrongCounts;
      const accuracy =
        totalAttempts > 0
          ? ((stats.correctCounts / totalAttempts) * 100).toFixed(2)
          : '0.00';

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📈 Counting Stats for ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          {
            name: 'Correct Counts',
            value: String(stats.correctCounts),
            inline: true,
          },
          {
            name: 'Wrong Counts',
            value: String(stats.wrongCounts),
            inline: true,
          },
          {
            name: 'Accuracy',
            value: `${accuracy}%`,
            inline: true,
          },
          {
            name: 'Highest Number Counted',
            value: String(stats.highestNumber),
            inline: true,
          },
          {
            name: 'Current Lives',
            value: String(lives),
            inline: true,
          },
          {
            name: 'Best Streak',
            value: String(stats.bestStreak || 0),
            inline: true,
          },
          {
            name: 'Total Attempts',
            value: String(totalAttempts),
            inline: true,
          }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('[Counting] Error in /counting-stats:', error);
      return interaction.reply({
        content: 'An error occurred while fetching user statistics.',
        ephemeral: true,
      });
    }
  },
};

export default statsCommand;
