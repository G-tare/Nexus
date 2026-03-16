import {
  SlashCommandBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { moduleContainer, addFields, v2Payload } from '../../../../Shared/src/utils/componentsV2';

export default {
  data: new SlashCommandBuilder()
    .setName('reverse')
    .setDescription('Reverse text')
    .addStringOption((option) =>
      option.setName('text').setDescription('Text to reverse').setRequired(true)
    ),

  module: 'fun',
  permissionPath: 'fun.random.reverse',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const text = interaction.options.getString('text', true);
      const reversed = text.split('').reverse().join('');

      const container = moduleContainer('fun');
      addFields(container, [
        { name: 'Original', value: text, inline: false },
        { name: 'Reversed', value: reversed, inline: false }
      ]);

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('Reverse error:', error);
      await interaction.reply({
        content: 'Failed to reverse text.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
} as BotCommand;
