import {
  SlashCommandBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
  TextChannel,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { checkCooldown, setCooldown, getRandomElement } from '../../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../../Shared/src/utils/componentsV2';

const PHRASES = [
  'The quick brown fox jumps over the lazy dog',
  'Discord is a great platform for gaming communities',
  'Programming is an art and a science combined together',
  'Coffee keeps programmers awake and productive today',
  'The weather is nice today for playing outside games',
  'Learning new things every day improves your skills',
  'Typing speed is important for developers everywhere',
  'Fast fingers and a sharp mind lead to success',
  'Technology changes the world every single day now',
  'Practice makes perfect in everything you do',
  'Time flies when you are having fun with friends',
  'The best things in life are worth waiting for today',
  'Never give up on your dreams no matter what happens',
  'Success is a journey not a destination point at all',
];

export default {
  data: new SlashCommandBuilder()
    .setName('fasttype')
    .setDescription('Type fast! Match the phrase exactly'),

  module: 'fun',
  permissionPath: 'fun.games.fasttype',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'fasttype');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before playing again!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const phrase = getRandomElement(PHRASES);
    const startTime = Date.now();

    const container = moduleContainer('fun');
    addText(container, '### Fast Type');
    addText(container, `Type this exactly:\n\n\`\`\`\n${phrase}\n\`\`\`\n\nYou have 15 seconds!`);

    await interaction.reply(v2Payload([container]));

    try {
      const filter = (m: any) => m.author.id === interaction.user.id;
      const collected = await (interaction.channel as TextChannel).awaitMessages({
        filter,
        max: 1,
        time: 15000,
      });

      if (collected.size === 0) {
        const timeoutContainer = moduleContainer('fun');
        addText(timeoutContainer, '### Time\'s Up!');
        addText(timeoutContainer, 'You didn\'t type fast enough!');
        await interaction.followUp(v2Payload([timeoutContainer]));
      } else {
        const userMsg = collected.first()!;
        const userText = userMsg.content;
        const timeTaken = (Date.now() - startTime) / 1000;
        const wordCount = phrase.split(' ').length;

        if (userText === phrase) {
          const wpm = Math.round((wordCount / timeTaken) * 60);
          const winContainer = moduleContainer('fun');
          addText(winContainer, '### Perfect! You Won!');
          addFields(winContainer, [
            { name: 'Time', value: `${timeTaken.toFixed(2)}s` },
            { name: 'WPM', value: String(wpm) },
            { name: 'Accuracy', value: '100%' },
          ]);
          await interaction.followUp(v2Payload([winContainer]));
        } else {
          const correctChars = Array.from(phrase).filter((char, i) => char === userText[i]).length;
          const accuracy = Math.round((correctChars / phrase.length) * 100);

          const closeContainer = moduleContainer('fun');
          addText(closeContainer, '### Not quite right!');
          addFields(closeContainer, [
            { name: 'Expected', value: `\`\`\`\n${phrase}\n\`\`\`` },
            { name: 'You typed', value: `\`\`\`\n${userText}\n\`\`\`` },
            { name: 'Accuracy', value: `${accuracy}%` },
          ]);
          await interaction.followUp(v2Payload([closeContainer]));
        }
      }
    } catch (error) {
      console.error('Fast Type error:', error);
    }

    await setCooldown(interaction.guildId!, interaction.user.id, 'fasttype', 3);
  },
} as BotCommand;
