import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addSeparator, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { evaluateExpression } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('calculator')
    .setDescription('Evaluate a mathematical expression')
    .addStringOption((opt) =>
      opt
        .setName('expression')
        .setDescription('Math expression (e.g., 2+2, 10*5, sqrt(16))')
        .setRequired(true)
    ),

  module: 'utilities',
  permissionPath: 'utilities.tools.calculator',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const expression = interaction.options.getString('expression', true);

      const { result, error } = evaluateExpression(expression);

      const container = moduleContainer('utilities');
      addText(container, '### 🧮 Calculator');
      addSeparator(container, 'small');
      addFields(container, [
        {
          name: 'Expression',
          value: `\`${expression}\``,
          inline: false,
        },
        {
          name: 'Result',
          value: error ? `❌ ${error}` : `\`${result}\``,
          inline: false,
        }
      ]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in calculator command:', error);
      await interaction.editReply({
        content: 'An error occurred while evaluating the expression.',
      });
    }
  },
};

export default command;
