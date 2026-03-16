import {
  SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getRaffle, buyTickets } from '../helpers';

export default {
  data: new SlashCommandBuilder()
    .setName('enterraffle')
    .setDescription('Buy tickets for a raffle')
    .addIntegerOption((option) => option.setName('raffle-id').setDescription('The raffle ID').setRequired(true).setMinValue(1))
    .addIntegerOption((option) => option.setName('tickets').setDescription('Number of tickets to buy (default: 1)').setMinValue(1).setMaxValue(100)),

  module: 'raffles',
  permissionPath: 'raffles.enter',
  premiumFeature: 'raffles.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    }

    const raffleId = interaction.options.getInteger('raffle-id', true);
    const ticketCount = interaction.options.getInteger('tickets') ?? 1;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const raffle = await getRaffle(raffleId);
    if (!raffle) {
      return interaction.editReply({ content: '❌ Raffle not found.' });
    }

    if (raffle.guildId !== interaction.guild.id) {
      return interaction.editReply({ content: '❌ This raffle is not in this server.' });
    }

    const result = await buyTickets(raffleId, interaction.user.id, interaction.guild.id, ticketCount);
    if (!result.success) {
      return interaction.editReply({ content: `❌ ${result.reason}` });
    }

    const currencyEmoji = raffle.currencyType === 'coins' ? '🪙' : raffle.currencyType === 'gems' ? '💎' : '🎟️';
    const totalCost = raffle.ticketPrice * ticketCount;

    return interaction.editReply({
      content: `✅ Successfully bought **${ticketCount}** ticket${ticketCount !== 1 ? 's' : ''} for **${totalCost}** ${currencyEmoji}!\n\nGood luck in the raffle! 🍀`,
    });
  },
} as BotCommand;
