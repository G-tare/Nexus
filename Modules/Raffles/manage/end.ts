import {
  SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getRaffle, endRaffle } from '../helpers';

export default {
  data: new SlashCommandBuilder()
    .setName('endraffle')
    .setDescription('End a raffle early and pick winners')
    .addIntegerOption((option) => option.setName('raffle-id').setDescription('The raffle ID').setRequired(true).setMinValue(1)),

  module: 'raffles',
  permissionPath: 'raffles.manage.end',
  premiumFeature: 'raffles.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    }

    const raffleId = interaction.options.getInteger('raffle-id', true);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const raffle = await getRaffle(raffleId);
    if (!raffle) {
      return interaction.editReply({ content: '❌ Raffle not found.' });
    }

    if (raffle.guildId !== interaction.guild.id) {
      return interaction.editReply({ content: '❌ This raffle is not in this server.' });
    }

    if (!raffle.isActive) {
      return interaction.editReply({ content: '❌ This raffle has already ended.' });
    }

    if (raffle.hostId !== interaction.user.id && !interaction.memberPermissions?.has('ManageGuild')) {
      return interaction.editReply({ content: '❌ Only the raffle host or server managers can end this raffle.' });
    }

    try {
      const winners = await endRaffle(raffle, interaction.guild);

      if (winners.length === 0) {
        return interaction.editReply({
          content: `✅ Raffle ended! No one participated, so no winners were selected.`,
        });
      }

      const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
      return interaction.editReply({
        content: `✅ Raffle ended! **${raffle.prize}** winner${winners.length !== 1 ? 's' : ''}: ${winnerMentions}`,
      });
    } catch (error) {
      console.error('Error ending raffle:', error);
      return interaction.editReply({ content: 'An error occurred while ending the raffle.' });
    }
  },
} as BotCommand;
