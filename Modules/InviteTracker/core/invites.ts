import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  User,
  PermissionFlagsBits,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getInviteConfig,
  getInviterStats,
  getInviterStatsInPeriod,
  buildInvitesEmbed,
} from '../helpers';

const command: BotCommand = {
  module: 'invitetracker',
  permissionPath: 'invitetracker.invites',
  premiumFeature: 'invitetracker.basic',
  data: new SlashCommandBuilder()
    .setName('invites')
    .setDescription('Check your or someone else\'s invite count')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('User to check invites for (default: yourself)')
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('days')
        .setDescription('Show invites from last X days')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(365)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const config = await getInviteConfig(interaction.guildId!);
    if (!config.enabled) {
      return interaction.editReply({
        content: 'Invite tracking is disabled on this server.',
      });
    }

    const targetUser: User = interaction.options.getUser('user') || interaction.user;
    const days: number | undefined = interaction.options.getInteger('days') || undefined;

    try {
      let stats = await getInviterStats(interaction.guildId!, targetUser.id);

      // If days specified, get period-specific count
      if (days) {
        const periodCount = await getInviterStatsInPeriod(
          interaction.guildId!,
          targetUser.id,
          days
        );
        // Modify the stats to show period data
        stats = {
          ...stats,
          real: periodCount,
          total: periodCount,
        };
      }

      const embed = buildInvitesEmbed(targetUser.id, stats, interaction.guild!, days);
      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in /invites command:', error);
      return interaction.editReply({
        content: 'An error occurred while fetching invite stats.',
      });
    }
  },
};

export default command;
