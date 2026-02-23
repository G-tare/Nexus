import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getUserActivityBreakdown, formatDuration } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';

const logger = createModuleLogger('ActivityTracking');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('activity')
    .setDescription('View activity statistics for a member')
    .addUserOption((option) =>
      option
        .setName('member')
        .setDescription('The member to view activity for (defaults to you)')
        .setRequired(false)
    ),

  module: 'activitytracking',
  permissionPath: 'activitytracking.activity',
  cooldown: 3,

  execute: async (interaction: ChatInputCommandInteraction) => {
    try {
      if (!interaction.guild) {
        await interaction.reply({
          content: 'This command can only be used in a server.',
          ephemeral: true,
        });
        return;
      }

      const targetUser = interaction.options.getUser('member') || interaction.user;

      // Fetch member to ensure they exist in the guild
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      if (!member) {
        await interaction.reply({
          content: 'That user is not a member of this server.',
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();

      const breakdown = await getUserActivityBreakdown(interaction.guild.id, targetUser.id, 30);

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`Activity Statistics for ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          {
            name: '📊 Overall Score',
            value: `\`${breakdown.score}\``,
            inline: true,
          },
          {
            name: '🏆 Leaderboard Rank',
            value: breakdown.rank ? `\`#${breakdown.rank}\`` : '`Not ranked`',
            inline: true,
          },
          {
            name: '\u200B',
            value: '\u200B',
            inline: true,
          },
          {
            name: '🎤 Voice Time',
            value: `\`${formatDuration(breakdown.voiceMinutes)}\``,
            inline: true,
          },
          {
            name: '💬 Messages',
            value: `\`${breakdown.messages}\``,
            inline: true,
          },
          {
            name: '👍 Reactions',
            value: `\`${breakdown.reactions}\``,
            inline: true,
          }
        )
        .setFooter({ text: 'Data from the last 30 days' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error executing activity command', error);
      if (interaction.deferred) {
        await interaction.editReply({ content: 'An error occurred while fetching activity data.' });
      } else {
        await interaction.reply({ content: 'An error occurred while fetching activity data.', ephemeral: true });
      }
    }
  },
};

export default command;
