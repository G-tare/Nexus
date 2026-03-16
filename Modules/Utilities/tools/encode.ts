import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addSeparator, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { encodeBase64 } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('encode')
    .setDescription('Encode text to Base64')
    .addStringOption((opt) =>
      opt
        .setName('text')
        .setDescription('Text to encode')
        .setRequired(true)
    ),

  module: 'utilities',
  permissionPath: 'utilities.tools.encode',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const text = interaction.options.getString('text', true);

      const encoded = encodeBase64(text);

      const container = moduleContainer('utilities');
      addText(container, '### 📝 Base64 Encode');
      addSeparator(container, 'small');
      addFields(container, [
        {
          name: 'Original',
          value: `\`\`\`${text}\`\`\``,
          inline: false,
        },
        {
          name: 'Encoded',
          value: `\`\`\`${encoded}\`\`\``,
          inline: false,
        }
      ]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in encode command:', error);
      await interaction.editReply({
        content: 'An error occurred while encoding the text.',
      });
    }
  },
};

export default command;
