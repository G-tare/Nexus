import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { parseDuration } from '../../../Shared/src/utils/time';
import { createGiveaway } from '../helpers';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';

export default {
  data: new SlashCommandBuilder()
    .setName('gschedule')
    .setDescription('Schedule a giveaway for later')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) => opt.setName('prize').setDescription('Prize').setRequired(true))
    .addStringOption((opt) => opt.setName('duration').setDescription('Giveaway duration (e.g. 1h, 2d)').setRequired(true))
    .addStringOption((opt) => opt.setName('start-in').setDescription('Start after (e.g. 1h, 30m)').setRequired(true))
    .addIntegerOption((opt) => opt.setName('winners').setDescription('Winner count').setMinValue(1).setMaxValue(20)),
  module: 'giveaways',
  permissionPath: 'giveaways.staff.schedule',
  premiumFeature: 'giveaways.basic',
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.channel) return interaction.reply({ content: 'Server only.', ephemeral: true });
    const prize = interaction.options.getString('prize', true);
    const durationStr = interaction.options.getString('duration', true);
    const startInStr = interaction.options.getString('start-in', true);
    const winnerCount = interaction.options.getInteger('winners') ?? 1;
    const duration = parseDuration(durationStr);
    const startIn = parseDuration(startInStr);
    if (!duration || !startIn) {
      return interaction.reply({ embeds: [errorEmbed('Invalid duration format.')] , ephemeral: true });
    }
    const startsAt = new Date(Date.now() + startIn);
    const endsAt = new Date(startsAt.getTime() + duration);
    try {
      const giveaway = await createGiveaway({
        guildId: interaction.guild.id,
        channelId: interaction.channel.id,
        hostId: interaction.user.id,
        prize,
        winnerCount,
        endsAt,
        isActive: false, // Will be activated when scheduled time arrives
      });
      return interaction.reply({ embeds: [successEmbed(`Giveaway #${giveaway.id} scheduled! Starts <t:${Math.floor(startsAt.getTime() / 1000)}:R>`)] , ephemeral: true });
    } catch (error) {
      console.error('Schedule error:', error);
      return interaction.reply({ embeds: [errorEmbed('Failed to schedule giveaway.')] , ephemeral: true });
    }
  },
} as BotCommand;
