import {
  SlashCommandBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
  TextChannel,
  Message,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { checkCooldown, setCooldown } from '../../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../../Shared/src/utils/componentsV2';

export default {
  data: new SlashCommandBuilder()
    .setName('guess')
    .setDescription('Guess a number between 1 and 100'),

  module: 'fun',
  permissionPath: 'fun.games.guess',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'guess');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before playing again!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const secretNumber = Math.floor(Math.random() * 100) + 1;
    let attempts = 0;
    const maxAttempts = 7;
    let guessed = false;

    const container = moduleContainer('fun');
    addText(container, '### Number Guessing Game');
    addText(container, `I've picked a number between 1 and 100.\nYou have ${maxAttempts} attempts to guess it!\n\n-# Type your guess in the chat`);

    await interaction.reply(v2Payload([container]));

    const filter = (msg: Message) => msg.author.id === interaction.user.id;

    try {
      const collector = (interaction.channel as TextChannel).createMessageCollector({
        filter,
        time: 120000,
        max: maxAttempts,
      });

      collector.on('collect', async (msg: Message) => {
        const guess = parseInt(msg.content);

        if (isNaN(guess) || guess < 1 || guess > 100) {
          await msg.reply('Please enter a valid number between 1 and 100!');
          return;
        }

        attempts++;
        let response = '';

        if (guess === secretNumber) {
          guessed = true;
          response = `🎉 You got it in **${attempts}** attempt${attempts > 1 ? 's' : ''}!`;
          collector.stop();
        } else if (guess < secretNumber) {
          response = `📈 Higher! (Attempt ${attempts}/${maxAttempts})`;
        } else {
          response = `📉 Lower! (Attempt ${attempts}/${maxAttempts})`;
        }

        const resultContainer = moduleContainer('fun');
        addText(resultContainer, response);

        await msg.reply(v2Payload([resultContainer]));

        if (attempts >= maxAttempts && !guessed) {
          collector.stop();
          const loseContainer = moduleContainer('fun');
          addText(loseContainer, '### Game Over!');
          addText(loseContainer, `You ran out of attempts! The number was **${secretNumber}**.`);
          await interaction.followUp(v2Payload([loseContainer]));
        }
      });

      collector.on('end', async () => {
        if (!guessed && attempts >= maxAttempts) {
          const finalContainer = moduleContainer('fun');
          addText(finalContainer, '### Game Over!');
          addText(finalContainer, `You lost! The number was **${secretNumber}**.`);
          await interaction.followUp(v2Payload([finalContainer]));
        }
      });
    } catch (error) {
      console.error('Guess game error:', error);
      await interaction.followUp({
        content: 'An error occurred during the game.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await setCooldown(interaction.guildId!, interaction.user.id, 'guess', 3);
  },
} as BotCommand;
