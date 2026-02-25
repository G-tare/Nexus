import {  SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getGiveaway, enterGiveaway, getEntryCount } from '../helpers';

export default {
  data: new SlashCommandBuilder()
    .setName('enter')
    .setDescription('Enter a giveaway by ID')
    .addIntegerOption((option) =>
      option.setName('id').setDescription('The giveaway ID to enter').setRequired(true).setMinValue(1)
    ),

  module: 'giveaways',
  permissionPath: 'giveaways.enter',
  premiumFeature: 'giveaways.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    }
    const giveawayId = interaction.options.getInteger('id', true);
    try {
      const giveaway = await getGiveaway(giveawayId);
      if (!giveaway || giveaway.guildId !== interaction.guild.id) {
        return interaction.reply({ content: `Giveaway with ID ${giveawayId} not found in this server.`, flags: MessageFlags.Ephemeral });
      }
      if (!giveaway.isActive) {
        return interaction.reply({ content: 'This giveaway is no longer active.', flags: MessageFlags.Ephemeral });
      }
      const result = await enterGiveaway(giveawayId, interaction.user.id);
      if (!result) {
        return interaction.reply({ content: 'You have already entered this giveaway!', flags: MessageFlags.Ephemeral });
      }
      return interaction.reply({ content: '✅ You have entered the giveaway! Good luck!', flags: MessageFlags.Ephemeral });
    } catch (error) {
      console.error('Error entering giveaway:', error);
      return interaction.reply({ content: 'An error occurred while entering the giveaway.', flags: MessageFlags.Ephemeral });
    }
  },
} as BotCommand;
