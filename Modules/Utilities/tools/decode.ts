import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addSeparator, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { decodeBase64 } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('decode')
    .setDescription('Decode Base64 text')
    .addStringOption((opt) =>
      opt
        .setName('text')
        .setDescription('Base64 text to decode')
        .setRequired(true)
    ),

  module: 'utilities',
  permissionPath: 'utilities.tools.decode',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const text = interaction.options.getString('text', true);

      const decoded = decodeBase64(text);

      const container = moduleContainer('utilities');
      addText(container, '### 📝 Base64 Decode');
      addSeparator(container, 'small');
      addFields(container, [
        {
          name: 'Encoded',
          value: `\`\`\`${text}\`\`\``,
          inline: false,
        },
        {
          name: 'Decoded',
          value: `\`\`\`${decoded}\`\`\``,
          inline: false,
        }
      ]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in decode command:', error);
      await interaction.editReply({
        content: 'An error occurred while decoding the text.',
      });
    }
  },
};

export default command;
