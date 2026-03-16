import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addSeparator, addFields, errorContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('steam')
    .setDescription('Search Steam games')
    .addStringOption((opt) =>
      opt
        .setName('game')
        .setDescription('Game name or title')
        .setRequired(true)
    ),

  module: 'utilities',
  permissionPath: 'utilities.search.steam',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const gameName = interaction.options.getString('game', true);

      // Fetch from Steam API
      const response = await fetch(
        `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameName)}&l=english&cc=US`
      );

      if (!response.ok) {
        throw new Error('Steam API request failed');
      }

      const data = (await response.json()) as any;
      const items = data.items || [];

      if (items.length === 0) {
        await interaction.editReply(v2Payload([errorContainer('No Games Found', `No games found for "${gameName}"`)]));
        return;
      }

      const container = moduleContainer('utilities');
      addText(container, `### 🎮 Steam Search Results\nTop results for "${gameName}"`);
      addText(container, `[Open in Steam](https://store.steampowered.com/search/?term=${encodeURIComponent(gameName)})`);
      addSeparator(container, 'small');

      const fields = items.slice(0, 5).map((item: any) => {
        const priceStr = item.price_overview?.final_formatted || 'Free to Play';
        return {
          name: item.name,
          value: `**Price:** ${priceStr}\n**App ID:** ${item.id}\n[View on Steam](https://store.steampowered.com/app/${item.id})`,
          inline: false,
        };
      });
      addFields(container, fields);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in steam search command:', error);
      await interaction.editReply({
        content: 'An error occurred while searching Steam.',
      });
    }
  },
};

export default command;
