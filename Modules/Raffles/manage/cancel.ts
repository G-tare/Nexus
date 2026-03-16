import {
  SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getRaffle, cancelRaffle, getRaffleConfig } from '../helpers';

export default {
  data: new SlashCommandBuilder()
    .setName('cancelraffle')
    .setDescription('Cancel a raffle and refund all participants')
    .addIntegerOption((option) => option.setName('raffle-id').setDescription('The raffle ID').setRequired(true).setMinValue(1))
    .addBooleanOption((option) => option.setName('refund').setDescription('Refund all participants (default: true)')),

  module: 'raffles',
  permissionPath: 'raffles.manage.cancel',
  premiumFeature: 'raffles.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    }

    const raffleId = interaction.options.getInteger('raffle-id', true);
    const shouldRefund = interaction.options.getBoolean('refund') ?? true;

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
      return interaction.editReply({ content: '❌ Only the raffle host or server managers can cancel this raffle.' });
    }

    try {
      // Cancel the raffle
      await cancelRaffle(raffle, interaction.guild);

      return interaction.editReply({
        content: `✅ Raffle cancelled! ${shouldRefund ? 'All participants have been refunded.' : 'No refunds were issued.'}`,
      });
    } catch (error) {
      console.error('Error cancelling raffle:', error);
      return interaction.editReply({ content: 'An error occurred while cancelling the raffle.' });
    }
  },
} as BotCommand;
