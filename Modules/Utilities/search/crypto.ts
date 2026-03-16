import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addSeparator, addFields, errorContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('crypto')
    .setDescription('Get cryptocurrency price information')
    .addStringOption((opt) =>
      opt
        .setName('coin')
        .setDescription('Coin name (e.g., bitcoin, ethereum)')
        .setRequired(true)
    ),

  module: 'utilities',
  permissionPath: 'utilities.search.crypto',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const coin = interaction.options.getString('coin', true).toLowerCase();

      // Fetch from CoinGecko API
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coin)}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`
      );

      if (!response.ok) {
        throw new Error('CoinGecko API request failed');
      }

      const data = (await response.json()) as any;
      const coinData = data[coin];

      if (!coinData) {
        await interaction.editReply(v2Payload([errorContainer('Cryptocurrency Not Found', `Cryptocurrency "${coin}" not found`)]));
        return;
      }

      const price = coinData.usd || 0;
      const change24h = coinData.usd_24h_change || 0;
      const marketCap = coinData.usd_market_cap || 0;
      const volume = coinData.usd_24h_vol || 0;

      const changeEmoji = change24h > 0 ? '📈' : '📉';

      const container = moduleContainer('utilities');
      addText(container, `### 💰 ${coin.toUpperCase()}`);
      addSeparator(container, 'small');
      addFields(container, [
        {
          name: 'Price',
          value: `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
          inline: true,
        },
        {
          name: '24h Change',
          value: `${changeEmoji} ${change24h.toFixed(2)}%`,
          inline: true,
        },
        {
          name: 'Market Cap',
          value: `$${(marketCap / 1e9).toFixed(2)}B`,
          inline: true,
        },
        {
          name: '24h Volume',
          value: `$${(volume / 1e9).toFixed(2)}B`,
          inline: true,
        }
      ]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in crypto command:', error);
      await interaction.editReply({
        content: 'An error occurred while fetching cryptocurrency price.',
      });
    }
  },
};

export default command;
