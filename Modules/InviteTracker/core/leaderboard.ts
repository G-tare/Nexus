import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ColorResolvable,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getInviteConfig, getTopInviters, buildLeaderboardEmbed } from '../helpers';

const command: BotCommand = {
  module: 'invitetracker',
  permissionPath: 'invitetracker.invite-leaderboard',
  premiumFeature: 'invitetracker.basic',
  data: new SlashCommandBuilder()
    .setName('invite-leaderboard')
    .setDescription('View the top inviters on this server')
    .addIntegerOption((option) =>
      option
        .setName('page')
        .setDescription('Page number (10 per page)')
        .setRequired(false)
        .setMinValue(1)
    )
    .addIntegerOption((option) =>
      option
        .setName('days')
        .setDescription('Filter by invites in last X days')
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

    const page = interaction.options.getInteger('page') || 1;
    const days = interaction.options.getInteger('days') || undefined;

    try {
      const topInviters = await getTopInviters(interaction.guildId!, 10, days);

      if (topInviters.length === 0) {
        return interaction.editReply({
          content: 'No invites recorded yet.',
        });
      }

      const embed = buildLeaderboardEmbed(
        topInviters,
        interaction.guild!.name,
        page,
        days
      );

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error in /invite-leaderboard command:', error);
      return interaction.editReply({
        content: 'An error occurred while fetching the leaderboard.',
      });
    }
  },
};

export default command;
