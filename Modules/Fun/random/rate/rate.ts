import {
  SlashCommandBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { moduleContainer, addText, v2Payload } from '../../../../Shared/src/utils/componentsV2';
import { getRandomElement } from '../../helpers';

const COMMENTARIES: Record<number, string[]> = {
  0: ['Absolutely terrible!', 'Worst thing ever.', 'Horrendous.'],
  1: ['Pretty bad tbh.', 'Not great.', 'Could be worse.'],
  2: ['Meh.', 'Not the best.', 'Underwhelming.'],
  3: ['Not too bad!', 'Could be better.', 'Acceptable.'],
  4: ['Pretty good!', 'Nice!', 'Solid choice.'],
  5: ['Great!', 'Excellent!', 'Really good.'],
  6: ['Very good!', 'Impressive!', 'Fantastic!'],
  7: ['Amazing!', 'Outstanding!', 'Superb!'],
  8: ['Incredible!', 'Phenomenal!', 'Astounding!'],
  9: ['Legendary!', 'Unbelievable!', 'Perfect!'],
  10: ['10/10 would recommend!', 'Absolutely flawless!', 'Perfection incarnate!'],
};

export default {
  data: new SlashCommandBuilder()
    .setName('rate')
    .setDescription('Rate anything from 0-10')
    .addStringOption((option) =>
      option.setName('thing').setDescription('What to rate').setRequired(true)
    ),

  module: 'fun',
  permissionPath: 'fun.random.rate',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const thing = interaction.options.getString('thing', true);
      const rating = Math.floor(Math.random() * 11);
      const commentary = getRandomElement(COMMENTARIES[rating]);

      const container = moduleContainer('fun');
      addText(container, `### Rate\nI'd rate **${thing}** a **${rating}/10**.\n\n${commentary}`);

      await interaction.reply(v2Payload([container]));
    } catch (error) {
      console.error('Rate error:', error);
      await interaction.reply({
        content: 'Failed to rate.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
} as BotCommand;
