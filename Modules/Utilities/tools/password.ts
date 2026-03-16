import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleContainer, addText, addSeparator, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';
import { generatePassword } from '../helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('password')
    .setDescription('Generate a secure random password')
    .addIntegerOption((opt) =>
      opt
        .setName('length')
        .setDescription('Password length (default 16, max 100)')
        .setMinValue(8)
        .setMaxValue(100)
        .setRequired(false)
    ),

  module: 'utilities',
  permissionPath: 'utilities.tools.password',

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const length = interaction.options.getInteger('length') ?? 16;

      const password = generatePassword(length);

      const container = moduleContainer('utilities');
      addText(container, '### 🔐 Password Generator');
      addSeparator(container, 'small');
      addFields(container, [
        {
          name: 'Generated Password',
          value: `\`\`\`${password}\`\`\``,
          inline: false,
        },
        {
          name: 'Length',
          value: `${length} characters`,
          inline: true,
        },
        {
          name: 'Strength',
          value: '✅ Strong',
          inline: true,
        }
      ]);

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error in password command:', error);
      await interaction.editReply({
        content: 'An error occurred while generating the password.',
      });
    }
  },
};

export default command;
