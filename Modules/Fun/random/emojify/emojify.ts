import {
  SlashCommandBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { moduleContainer, addText, v2Payload } from '../../../../Shared/src/utils/componentsV2';

export default {
  data: new SlashCommandBuilder()
    .setName('emojify')
    .setDescription('Convert text to emoji letters')
    .addStringOption((option) =>
      option.setName('text').setDescription('Text to emojify').setRequired(true)
    ),

  module: 'fun',
  permissionPath: 'fun.random.emojify',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      let text = interaction.options.getString('text', true).toUpperCase().slice(0, 50);

      let result = '';
      for (const char of text) {
        if (char === ' ') {
          result += '   ';
        } else if (/[A-Z]/.test(char)) {
          const code = char.charCodeAt(0);
          result += String.fromCodePoint(0x1f1e6 + (code - 65)) + ' ';
        } else if (/[0-9]/.test(char)) {
          const numberEmojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
          result += numberEmojis[parseInt(char)] + ' ';
        } else {
          result += char + ' ';
        }
      }

      const container = moduleContainer('fun');
      addText(container, '### Emojify');
      addText(container, result);

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('Emojify error:', error);
      await interaction.reply({
        content: 'Failed to emojify text.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
} as BotCommand;
