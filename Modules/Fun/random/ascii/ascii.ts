import {
  SlashCommandBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { moduleContainer, addText, v2Payload } from '../../../../Shared/src/utils/componentsV2';

const BLOCK_FONT: Record<string, string[]> = {
  'A': ['███', '█ █', '███', '█ █', '█ █'],
  'B': ['██ ', '█ █', '██ ', '█ █', '██ '],
  'C': [' ██', '█  ', '█  ', '█  ', ' ██'],
  'D': ['██ ', '█ █', '█ █', '█ █', '██ '],
  'E': ['███', '█  ', '██ ', '█  ', '███'],
  'F': ['███', '█  ', '██ ', '█  ', '█  '],
  'G': [' ██', '█  ', '█ █', '█ █', ' ██'],
  'H': ['█ █', '█ █', '███', '█ █', '█ █'],
  'I': ['███', ' █ ', ' █ ', ' █ ', '███'],
  'J': ['███', '  █', '  █', '█ █', ' ██'],
  'K': ['█ █', '██ ', '██ ', '█ █', '█ █'],
  'L': ['█  ', '█  ', '█  ', '█  ', '███'],
  'M': ['█ █', '███', '█ █', '█ █', '█ █'],
  'N': ['██ ', '███', '███', '█ █', '█ █'],
  'O': [' ██', '█ █', '█ █', '█ █', ' ██'],
  'P': ['██ ', '█ █', '██ ', '█  ', '█  '],
  'Q': [' ██', '█ █', '█ █', ' █ ', '  █'],
  'R': ['██ ', '█ █', '██ ', '█ █', '█ █'],
  'S': [' ██', '█  ', ' ██', '  █', '██ '],
  'T': ['███', ' █ ', ' █ ', ' █ ', ' █ '],
  'U': ['█ █', '█ █', '█ █', '█ █', ' ██'],
  'V': ['█ █', '█ █', '█ █', ' █ ', ' █ '],
  'W': ['█ █', '█ █', '█ █', '███', '█ █'],
  'X': ['█ █', ' █ ', ' █ ', ' █ ', '█ █'],
  'Y': ['█ █', ' █ ', ' █ ', ' █ ', ' █ '],
  'Z': ['███', '  █', ' █ ', '█  ', '███'],
  '0': [' ██', '█ █', '█ █', '█ █', ' ██'],
  '1': [' █ ', '██ ', ' █ ', ' █ ', '███'],
  '2': [' ██', '█ █', '  █', '█  ', '███'],
  '3': ['██ ', '  █', ' ██', '  █', '██ '],
  '4': ['█ █', '█ █', '███', '  █', '  █'],
  '5': ['███', '█  ', '██ ', '  █', '██ '],
  '6': [' ██', '█  ', '██ ', '█ █', ' ██'],
  '7': ['███', '  █', '  █', ' █ ', '█  '],
  '8': [' ██', '█ █', ' ██', '█ █', ' ██'],
  '9': [' ██', '█ █', ' ██', '  █', ' ██'],
  ' ': ['   ', '   ', '   ', '   ', '   '],
};

export default {
  data: new SlashCommandBuilder()
    .setName('ascii')
    .setDescription('Convert text to ASCII art')
    .addStringOption((option) =>
      option.setName('text').setDescription('Text to convert (max 20 chars)').setRequired(true)
    ),

  module: 'fun',
  permissionPath: 'fun.random.ascii',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      let text = interaction.options.getString('text', true).toUpperCase().slice(0, 20);

      const lines: string[] = ['', '', '', '', ''];
      for (const char of text) {
        const font = BLOCK_FONT[char] || BLOCK_FONT[' '];
        for (let i = 0; i < 5; i++) {
          lines[i] += font[i] + ' ';
        }
      }

      const asciiArt = lines.join('\n');

      const container = moduleContainer('fun');
      addText(container, '### ASCII Art');
      addText(container, `\`\`\`\n${asciiArt}\n\`\`\``);

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('ASCII error:', error);
      await interaction.reply({
        content: 'Failed to generate ASCII art.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
} as BotCommand;
