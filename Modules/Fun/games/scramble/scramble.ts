import {
  SlashCommandBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
  TextChannel,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { checkCooldown, setCooldown, getRandomElement, shuffleArray } from '../../helpers';
import { moduleContainer, addText, v2Payload } from '../../../../Shared/src/utils/componentsV2';

const WORDS = [
  'ADVENTURE', 'BEAUTIFUL', 'CELEBRATE', 'DETECTIVE', 'ENCYCLOPEDIA', 'FASCINATING', 'GENEROUS',
  'HORIZONTAL', 'IMPORTANT', 'JEALOUSY', 'KNOWLEDGE', 'LITERATURE', 'MAGNIFICENT', 'NIGHTMARE',
  'OPERATION', 'PHOTOGRAPH', 'QUESTION', 'RESTAURANT', 'STRENGTH', 'TEMPERATURE', 'UNIVERSE',
  'VOCABULARY', 'WEDNESDAY', 'XYLOPHONE', 'YESTERDAY', 'ZENITH', 'ABSOLUTE', 'BACKGROUND',
  'CALCULATE', 'DIFFERENT', 'EDUCATION', 'FAVORITE', 'GUARANTEE', 'HOSPITAL', 'IMMEDIATE',
  'JOURNEY', 'KITCHEN', 'LANGUAGE', 'MEDICINE', 'NEGOTIATE', 'ORGANIZE', 'PATIENT',
  'QUALITY', 'RECEIVE', 'SCIENCE', 'TOGETHER', 'UNDERSTAND', 'VACATION', 'WELCOME',
];

export default {
  data: new SlashCommandBuilder()
    .setName('scramble')
    .setDescription('Unscramble the word'),

  module: 'fun',
  permissionPath: 'fun.games.scramble',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'scramble');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before playing again!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const word = getRandomElement(WORDS);
    const scrambled = shuffleArray(word.split('')).join('');
    let hintGiven = false;
    const startTime = Date.now();

    const container = moduleContainer('fun');
    addText(container, '### Word Scramble');
    addText(container, `Unscramble: **${scrambled}**\n\nYou have 30 seconds!\n(Hint available after 15 seconds)`);

    await interaction.reply(v2Payload([container]));

    try {
      const filter = (m: any) => m.author.id === interaction.user.id;
      const collected = await (interaction.channel as TextChannel).awaitMessages({
        filter,
        time: 30000,
        max: 100,
      });

      for (const msg of collected.values()) {
        const elapsed = (Date.now() - startTime) / 1000;

        if (msg.content.toUpperCase() === word) {
          const winContainer = moduleContainer('fun');
          addText(winContainer, '### Correct!');
          addText(winContainer, `The word was: **${word}**\nTime: ${elapsed.toFixed(2)}s`);
          await interaction.followUp(v2Payload([winContainer]));
          await setCooldown(interaction.guildId!, interaction.user.id, 'scramble', 3);
          return;
        } else if (!hintGiven && elapsed > 15) {
          hintGiven = true;
          const hint = `${word[0]}${'_'.repeat(word.length - 2)}${word[word.length - 1]}`;
          const hintContainer = moduleContainer('fun');
          addText(hintContainer, `**Hint:** ${hint}`);
          await interaction.followUp(v2Payload([hintContainer]));
        }
      }

      const timeoutContainer = moduleContainer('fun');
      addText(timeoutContainer, '### Time\'s Up!');
      addText(timeoutContainer, `The word was: **${word}**`);
      await interaction.followUp(v2Payload([timeoutContainer]));
    } catch (error) {
      console.error('Scramble error:', error);
    }

    await setCooldown(interaction.guildId!, interaction.user.id, 'scramble', 3);
  },
} as BotCommand;
