import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getGiveaway, rerollGiveaway } from '../helpers';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';

export default {
  data: new SlashCommandBuilder()
    .setName('greroll')
    .setDescription('Reroll giveaway winners')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption((opt) => opt.setName('id').setDescription('Giveaway ID').setRequired(true).setMinValue(1))
    .addIntegerOption((opt) => opt.setName('count').setDescription('Number of new winners').setMinValue(1).setMaxValue(20)),
  module: 'giveaways',
  permissionPath: 'giveaways.manage.reroll',
  premiumFeature: 'giveaways.basic',
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return interaction.reply({ content: 'Server only.', ephemeral: true });
    const id = interaction.options.getInteger('id', true);
    const count = interaction.options.getInteger('count') ?? undefined;
    const giveaway = await getGiveaway(id);
    if (!giveaway || giveaway.guildId !== interaction.guild.id) {
      return interaction.reply({ embeds: [errorEmbed('Giveaway not found.')] , ephemeral: true });
    }
    const newWinners = await rerollGiveaway(giveaway, interaction.guild, count);
    if (!newWinners.length) {
      return interaction.reply({ embeds: [errorEmbed('No valid entries to reroll from.')] , ephemeral: true });
    }
    return interaction.reply({ embeds: [successEmbed(`New winners: ${newWinners.map((w) => `<@${w}>`).join(', ')}`)] , ephemeral: true });
  },
} as BotCommand;
