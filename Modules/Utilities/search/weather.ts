import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addSeparator, addFields, errorContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get weather information for a location')
    .addStringOption((opt) =>
      opt
        .setName('location')
        .setDescription('City or location name')
        .setRequired(true)
    ),

  module: 'utilities',
  permissionPath: 'utilities.search.weather',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const location = interaction.options.getString('location', true);

      // Fetch from wttr.in API
      const response = await fetch(
        `https://wttr.in/${encodeURIComponent(location)}?format=j1`
      );

      if (!response.ok) {
        throw new Error('Weather API request failed');
      }

      const data = (await response.json()) as any;
      const current = data.current_condition?.[0];
      const forecast = data.weather?.[0];

      if (!current || !forecast) {
        await interaction.editReply(v2Payload([errorContainer('Weather Data Not Found', `Could not find weather data for "${location}"`)]));
        return;
      }

      const container = moduleContainer('utilities');
      addText(container, `### 🌍 Weather for ${location}`);
      addSeparator(container, 'small');
      addFields(container, [
        {
          name: 'Current Temperature',
          value: `${current.temp_C}°C (${current.temp_F}°F)`,
          inline: true,
        },
        {
          name: 'Condition',
          value: current.weatherDesc?.[0]?.value || 'Unknown',
          inline: true,
        },
        {
          name: 'Feels Like',
          value: `${current.FeelsLikeC}°C`,
          inline: true,
        },
        {
          name: 'Humidity',
          value: `${current.humidity}%`,
          inline: true,
        },
        {
          name: 'Wind Speed',
          value: `${current.windspeedKmph} km/h`,
          inline: true,
        },
        {
          name: 'Visibility',
          value: `${current.visibility} km`,
          inline: true,
        }
      ]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in weather command:', error);
      await interaction.editReply({
        content: 'An error occurred while fetching weather information.',
      });
    }
  },
};

export default command;
