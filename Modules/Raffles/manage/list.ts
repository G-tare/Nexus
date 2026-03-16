import {
  SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getActiveRaffles, getRaffleConfig } from '../helpers';
import { moduleContainer, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';

export default {
  data: new SlashCommandBuilder()
    .setName('raffles')
    .setDescription('View all active raffles in this server'),

  module: 'raffles',
  permissionPath: 'raffles.manage.list',
  premiumFeature: 'raffles.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const activeRaffles = await getActiveRaffles(interaction.guild.id);

    if (activeRaffles.length === 0) {
      const container = moduleContainer('raffles');
      addText(container, '### No Active Raffles\nThere are currently no active raffles in this server.');
      return interaction.editReply(v2Payload([container]));
    }

    const config = await getRaffleConfig(interaction.guild.id);
    const container = moduleContainer('raffles');
    addText(container, `### 🎟️ Active Raffles (${activeRaffles.length})\nHere are all the active raffles in this server`);

    const raffleLines = activeRaffles.map(raffle => {
      const currencyEmoji = raffle.currencyType === 'coins' ? '🪙' : raffle.currencyType === 'gems' ? '💎' : '🎟️';
      return `**#${raffle.id}** - ${raffle.prize}\nTickets: ${raffle.totalTickets} | Participants: ${raffle.ticketCount} | Price: ${raffle.ticketPrice}${currencyEmoji} | Ends: <t:${Math.floor(raffle.endsAt.getTime() / 1000)}:R>`;
    });

    addText(container, raffleLines.join('\n\n'));

    return interaction.editReply(v2Payload([container]));
  },
} as BotCommand;
