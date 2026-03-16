import {
  SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getActiveRaffles, getUserTickets } from '../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

export default {
  data: new SlashCommandBuilder()
    .setName('mytickets')
    .setDescription('View your tickets in active raffles'),

  module: 'raffles',
  permissionPath: 'raffles.mytickets',
  premiumFeature: 'raffles.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const raffles = await getActiveRaffles(interaction.guild.id);

    if (raffles.length === 0) {
      const container = moduleContainer('raffles');
      addText(container, '### No Active Raffles\nThere are currently no active raffles in this server.');
      return interaction.editReply(v2Payload([container]));
    }

    const container = moduleContainer('raffles');
    addText(container, `### 🎟️ Your Raffle Tickets\nHere are your tickets in the ${raffles.length} active raffle${raffles.length !== 1 ? 's' : ''}`);

    let hasTickets = false;
    const ticketFields = [];

    for (const raffle of raffles) {
      const userTickets = await getUserTickets(raffle.id, interaction.user.id);
      if (userTickets > 0) {
        hasTickets = true;
        const currencyEmoji = raffle.currencyType === 'coins' ? '🪙' : raffle.currencyType === 'gems' ? '💎' : '🎟️';
        const totalCost = userTickets * raffle.ticketPrice;
        ticketFields.push({
          name: raffle.prize,
          value: `**${userTickets}** ticket${userTickets !== 1 ? 's' : ''} · ${totalCost} ${currencyEmoji} spent · Ends <t:${Math.floor(raffle.endsAt.getTime() / 1000)}:R>`,
          inline: false,
        });
      }
    }

    if (!hasTickets) {
      addText(container, 'You don\'t have any tickets in active raffles yet.');
    } else {
      addFields(container, ticketFields);
    }

    return interaction.editReply(v2Payload([container]));
  },
} as BotCommand;
