import {
  SlashCommandBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonInteraction,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { checkCooldown, setCooldown, getRandomElement } from '../../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../../Shared/src/utils/componentsV2';

const WORD_BANK = [
  // Animals
  'elephant', 'giraffe', 'penguin', 'butterfly', 'dolphin', 'flamingo', 'leopard', 'cheetah',
  'hippopotamus', 'rhinoceros', 'platypus', 'peacock', 'ostrich',
  // Countries
  'australia', 'canada', 'germany', 'france', 'portugal', 'argentina', 'morocco', 'greece',
  'thailand', 'vietnam', 'colombia', 'netherlands',
  // Food
  'spaghetti', 'hamburger', 'chocolate', 'strawberry', 'watermelon', 'pineapple', 'broccoli',
  'pancakes', 'popcorn', 'cinnamon', 'asparagus', 'artichoke',
  // Technology
  'algorithm', 'database', 'cryptography', 'bandwidth', 'interface', 'protocol', 'compiler',
  'programmer', 'javascript', 'cryptocurrency', 'blockchain', 'cybersecurity',
  // Other
  'adventure', 'beautiful', 'celebrate', 'detective', 'encyclopedia', 'fascinating', 'generator',
  'horizontal', 'important', 'jealousy', 'knowledge', 'literature', 'magnificent',
  'nightmare', 'operation', 'photograph', 'question', 'restaurant', 'strength',
  'temperature', 'university', 'vocabulary', 'wednesday', 'xylophone', 'yesterday', 'zealous',
];

const HANGMAN_STAGES = [
  '```\n  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========```',
  '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========```',
];

export default {
  data: new SlashCommandBuilder()
    .setName('hangman')
    .setDescription('Play hangman'),

  module: 'fun',
  permissionPath: 'fun.games.hangman',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'hangman');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before playing again!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const word = getRandomElement(WORD_BANK).toUpperCase();
    const wordLength = word.length;
    let guessedLetters: Set<string> = new Set();
    let wrongGuesses: Set<string> = new Set();
    let gameOver = false;
    let won = false;
    let wrongCount = 0;

    const getWordDisplay = () => {
      return word.split('').map(letter => (guessedLetters.has(letter) ? letter : '_')).join(' ');
    };

    const checkWin = () => {
      return word.split('').every(letter => guessedLetters.has(letter));
    };

    const buildContainer = () => {
      const container = moduleContainer('fun');
      addText(container, '### Hangman');
      addText(container, HANGMAN_STAGES[wrongCount]);
      addFields(container, [
        { name: 'Word', value: getWordDisplay() },
        { name: 'Wrong Guesses', value: wrongGuesses.size > 0 ? Array.from(wrongGuesses).join(', ') : 'None' },
        { name: 'Remaining', value: `${7 - wrongCount}/7` },
      ]);
      return container;
    };

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('guess_letter')
          .setLabel('Guess Letter')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('guess_word')
          .setLabel('Guess Word')
          .setStyle(ButtonStyle.Secondary)
      );

    const startContainer = buildContainer();
    startContainer.addActionRowComponents(row);
    const replyMessage = await interaction.reply({ ...v2Payload([startContainer]), fetchReply: true });

    const collector = replyMessage.createMessageComponentCollector({
      time: 300000,
    });

    if (!collector) {
      await setCooldown(interaction.guildId!, interaction.user.id, 'hangman', 3);
      return;
    }

    collector.on('collect', async (btnInteraction: ButtonInteraction) => {
      if (btnInteraction.user.id !== interaction.user.id) {
        await btnInteraction.reply({
          content: 'This is not your game!',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (gameOver) {
        await btnInteraction.reply({
          content: 'Game is already over!',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (btnInteraction.customId === 'guess_letter') {
        const modal = new ModalBuilder()
          .setCustomId('hangman_letter_modal')
          .setTitle('Guess a Letter');

        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('letter_input')
              .setLabel('Enter a single letter')
              .setStyle(TextInputStyle.Short)
              .setMaxLength(1)
              .setRequired(true)
          )
        );

        await btnInteraction.showModal(modal);

        try {
          const modalSubmit = await btnInteraction.awaitModalSubmit({ time: 60000 });
          const letter = modalSubmit.fields.getTextInputValue('letter_input').toUpperCase();

          if (!/^[A-Z]$/.test(letter)) {
            await modalSubmit.reply({
              content: 'Please enter a valid letter!',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          if (guessedLetters.has(letter) || wrongGuesses.has(letter)) {
            await modalSubmit.reply({
              content: 'Already guessed!',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }

          if (word.includes(letter)) {
            guessedLetters.add(letter);
          } else {
            wrongGuesses.add(letter);
            wrongCount++;
          }

          if (checkWin()) {
            gameOver = true;
            won = true;
            const winContainer = buildContainer();
            addText(winContainer, '### You Won!');
            await modalSubmit.reply(v2Payload([winContainer]));
            collector.stop();
          } else if (wrongCount >= 7) {
            gameOver = true;
            guessedLetters = new Set(word.split(''));
            const loseContainer = moduleContainer('fun');
            addText(loseContainer, '### You Lost!');
            addText(loseContainer, `${HANGMAN_STAGES[6]}\n\nThe word was: **${word}**`);
            await modalSubmit.reply(v2Payload([loseContainer]));
            collector.stop();
          } else {
            const newContainer = buildContainer();
            await modalSubmit.reply(v2Payload([newContainer]));
          }
        } catch (error) {
          console.error('Modal timeout:', error);
        }
      } else if (btnInteraction.customId === 'guess_word') {
        const modal = new ModalBuilder()
          .setCustomId('hangman_word_modal')
          .setTitle('Guess the Word');

        modal.addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('word_input')
              .setLabel('Enter the complete word')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );

        await btnInteraction.showModal(modal);

        try {
          const modalSubmit = await btnInteraction.awaitModalSubmit({ time: 60000 });
          const guess = modalSubmit.fields.getTextInputValue('word_input').toUpperCase();

          if (guess === word) {
            gameOver = true;
            won = true;
            guessedLetters = new Set(word.split(''));
            const winContainer = buildContainer();
            addText(winContainer, '### You Won!');
            await modalSubmit.reply(v2Payload([winContainer]));
            collector.stop();
          } else {
            wrongCount++;
            if (wrongCount >= 7) {
              gameOver = true;
              guessedLetters = new Set(word.split(''));
              const loseContainer = moduleContainer('fun');
              addText(loseContainer, '### You Lost!');
              addText(loseContainer, `${HANGMAN_STAGES[6]}\n\nThe word was: **${word}**`);
              await modalSubmit.reply(v2Payload([loseContainer]));
              collector.stop();
            } else {
              const newContainer = buildContainer();
              await modalSubmit.reply(v2Payload([newContainer]));
            }
          }
        } catch (error) {
          console.error('Modal timeout:', error);
        }
      }
    });

    collector.on('end', async () => {
      if (!gameOver) {
        gameOver = true;
        guessedLetters = new Set(word.split(''));
        const timeoutContainer = moduleContainer('fun');
        addText(timeoutContainer, '### Time\'s Up!');
        addText(timeoutContainer, `The word was: **${word}**`);
        await interaction.followUp(v2Payload([timeoutContainer]));
      }
    });

    await setCooldown(interaction.guildId!, interaction.user.id, 'hangman', 3);
  },
} as BotCommand;
