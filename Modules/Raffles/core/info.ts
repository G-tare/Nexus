import {
  SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getRaffle, getRaffleConfig, getUserTickets } from '../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

export default {
  data: new SlashCommandBuilder()
    .setName('raffleinfo')
    .setDescription('Get details about a specific raffle')
    .addIntegerOption((option) => option.setName('raffle-id').setDescription('The raffle ID').setRequired(true).setMinValue(1)),

  module: 'raffles',
  permissionPath: 'raffles.info',
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

    const config = await getRaffleConfig(interaction.guild.id);
    const currencyEmoji = raffle.currencyType === 'coins' ? '🪙' : raffle.currencyType === 'gems' ? '💎' : '🎟️';
    const userTickets = await getUserTickets(raffleId, interaction.user.id);

    const container = moduleContainer('raffles');
    addText(container, `### 🎟️ ${raffle.prize}`);
    if (raffle.description) {
      addText(container, raffle.description);
    }

    const fields = [
      { name: 'Raffle ID', value: String(raffle.id), inline: true },
      { name: 'Status', value: raffle.isActive ? '✅ Active' : '❌ Ended', inline: true },
      { name: 'Ticket Price', value: `${raffle.ticketPrice} ${currencyEmoji}`, inline: true },
      { name: 'Total Participants', value: String(raffle.ticketCount), inline: true },
      { name: 'Total Tickets Sold', value: String(raffle.totalTickets), inline: true },
      { name: 'Your Tickets', value: String(userTickets), inline: true },
      { name: 'Max per User', value: String(raffle.maxTicketsPerUser), inline: true },
      { name: 'Winners', value: String(raffle.winnerCount), inline: true },
      { name: 'Starts', value: `<t:${Math.floor(raffle.startsAt.getTime() / 1000)}:F>`, inline: true },
      { name: 'Ends', value: `<t:${Math.floor(raffle.endsAt.getTime() / 1000)}:F>`, inline: true },
      { name: 'Time Remaining', value: `<t:${Math.floor(raffle.endsAt.getTime() / 1000)}:R>`, inline: true },
    ];

    if (raffle.maxTotalTickets) {
      fields.push({
        name: 'Max Total Tickets',
        value: `${raffle.totalTickets}/${raffle.maxTotalTickets}`,
        inline: true,
      });
    }

    addFields(container, fields);

    if (!raffle.isActive && raffle.winners.length > 0) {
      addText(container, `**Winners**\n${raffle.winners.map(id => `<@${id}>`).join(', ')}`);
    }

    return interaction.editReply(v2Payload([container]));
  },
} as BotCommand;
