import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getGiveaway, endGiveaway } from '../helpers';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';

export default {
  data: new SlashCommandBuilder()
    .setName('gend')
    .setDescription('End a giveaway early')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addIntegerOption((opt) => opt.setName('id').setDescription('Giveaway ID').setRequired(true).setMinValue(1)),
  module: 'giveaways',
  permissionPath: 'giveaways.manage.end',
  premiumFeature: 'giveaways.basic',
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return interaction.reply({ content: 'Server only.', ephemeral: true });
    const id = interaction.options.getInteger('id', true);
    const giveaway = await getGiveaway(id);
    if (!giveaway || giveaway.guildId !== interaction.guild.id) {
      return interaction.reply({ embeds: [errorEmbed('Giveaway not found.')] , ephemeral: true });
    }
    if (!giveaway.isActive) {
      return interaction.reply({ embeds: [errorEmbed('Giveaway is not active.')] , ephemeral: true });
    }
    const winners = await endGiveaway(giveaway, interaction.guild);
    const winnerStr = winners.length ? winners.map((w) => `<@${w}>`).join(', ') : 'No winners';
    return interaction.reply({ embeds: [successEmbed(`Giveaway ended! Winners: ${winnerStr}`)] , ephemeral: true });
  },
} as BotCommand;
