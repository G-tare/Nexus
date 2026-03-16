import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addSeparator, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { emojifyText } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('util-emojify')
    .setDescription('Convert text to emoji regional indicators')
    .addStringOption((opt) =>
      opt
        .setName('text')
        .setDescription('Text to emojify')
        .setRequired(true)
    ),

  module: 'utilities',
  permissionPath: 'utilities.tools.emojify',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const text = interaction.options.getString('text', true);

      const emojified = emojifyText(text);

      const container = moduleContainer('utilities');
      addText(container, '### 😀 Emojify');
      addSeparator(container, 'small');
      addText(container, `**Original**\n${text}`);
      addText(container, `**Emojified**\n${emojified}`);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in emojify command:', error);
      await interaction.editReply({
        content: 'An error occurred while emojifying the text.',
      });
    }
  },
};

export default command;
