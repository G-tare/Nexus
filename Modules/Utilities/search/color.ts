import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addSeparator, addSectionWithThumbnail, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { parseColor } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('utilities-colorinfo')
    .setDescription('Get color information and preview')
    .addStringOption((opt) =>
      opt
        .setName('hex')
        .setDescription('Hex color code (e.g., #FF5733)')
        .setRequired(true)
    ),

  module: 'utilities',
  permissionPath: 'utilities.search.color',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const hexInput = interaction.options.getString('hex', true);

      const result = parseColor(hexInput);

      if (!result) {
        await interaction.editReply({
          content: '❌ Invalid hex color code. Please use format: `#FF5733` or `FF5733`',
        });
        return;
      }

      const { rgb, hsl } = result;

      // Create a color preview image
      const normalizedHex = hexInput.startsWith('#') ? hexInput.slice(1) : hexInput;
      const colorPreviewUrl = `https://via.placeholder.com/200x200/${normalizedHex}?text=`;

      const container = moduleContainer('utilities');
      addSectionWithThumbnail(
        container,
        '### 🎨 Color Information\nColor preview and values',
        colorPreviewUrl
      );
      addSeparator(container, 'small');
      addFields(container, [
        {
          name: 'HEX',
          value: `\`${hexInput.toUpperCase()}\``,
          inline: true,
        },
        {
          name: 'RGB',
          value: `\`${rgb}\``,
          inline: true,
        },
        {
          name: 'HSL',
          value: `\`${hsl}\``,
          inline: true,
        }
      ]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in color command:', error);
      await interaction.editReply({
        content: 'An error occurred while processing the color.',
      });
    }
  },
};

export default command;
