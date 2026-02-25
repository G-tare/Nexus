import {  SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, TextChannel, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { createGiveaway, buildDropEmbed } from '../helpers';
import { successEmbed, errorEmbed } from '../../../Shared/src/utils/embed';

export default {
  data: new SlashCommandBuilder()
    .setName('drop')
    .setDescription('Create a first-come-first-serve drop giveaway')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) => opt.setName('prize').setDescription('Prize').setRequired(true))
    .addIntegerOption((opt) => opt.setName('winners').setDescription('Max claims').setRequired(true).setMinValue(1).setMaxValue(50)),
  module: 'giveaways',
  permissionPath: 'giveaways.staff.drop',
  premiumFeature: 'giveaways.basic',
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return interaction.reply({ content: 'Server only.' });
    const prize = interaction.options.getString('prize', true);
    const maxWinners = interaction.options.getInteger('winners', true);
    const channel = interaction.channel as TextChannel;
    try {
      const giveaway = await createGiveaway({
        guildId: interaction.guild.id,
        channelId: channel.id,
        hostId: interaction.user.id,
        prize,
        winnerCount: maxWinners,
        endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h default
      });
      const embed = buildDropEmbed(prize, maxWinners, []);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`giveaway_enter_${giveaway.id}`).setLabel('🎁 Claim').setStyle(ButtonStyle.Success)
      );
      await (channel as any).send({ embeds: [embed], components: [row] });
      return interaction.reply({ embeds: [successEmbed('Drop created!')]  });
    } catch (error) {
      console.error('Drop error:', error);
      return interaction.reply({ embeds: [errorEmbed('Failed to create drop.')]  });
    }
  },
} as BotCommand;
