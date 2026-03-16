import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getUserActivityBreakdown, formatDuration } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, addText, addFields, addSectionWithThumbnail, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

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
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const targetUser = interaction.options.getUser('member') || interaction.user;

      // Fetch member to ensure they exist in the guild
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      if (!member) {
        await interaction.reply({
          content: 'That user is not a member of this server.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await interaction.deferReply();

      const breakdown = await getUserActivityBreakdown(interaction.guild.id, targetUser.id, 30);

      const container = moduleContainer('activity_tracking');
      addText(container, `### Activity Statistics for ${targetUser.username}`);
      addFields(container, [
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
      ]);
      addFooter(container, 'Data from the last 30 days');

      const payload = v2Payload([container]);
      await interaction.editReply(payload);
    } catch (error) {
      logger.error('Error executing activity command', error);
      if (interaction.deferred) {
        await interaction.editReply({ content: 'An error occurred while fetching activity data.' });
      } else {
        await interaction.reply({ content: 'An error occurred while fetching activity data.', flags: MessageFlags.Ephemeral });
      }
    }
  },
};

export default command;
