import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalActionRowComponentBuilder,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types';
import { checkCooldown, setCooldown } from '../../helpers';


const WORD_LIST = [
  'about', 'above', 'abuse', 'access', 'admit', 'adopt', 'adult', 'after', 'again', 'agent',
  'agree', 'alarm', 'album', 'alert', 'alien', 'align', 'alike', 'alive', 'allow', 'alone',
  'along', 'alter', 'angel', 'anger', 'angle', 'angry', 'apart', 'apple', 'apply', 'arena',
  'argue', 'arise', 'array', 'arrow', 'aside', 'asset', 'audio', 'avoid', 'await', 'awake',
  'award', 'aware', 'badly', 'beach', 'began', 'begin', 'being', 'below', 'bench', 'billy',
];

interface WordleGame {
  word: string;
  guesses: string[];
  gameOver: boolean;
  won: boolean;
}

const activeGames = new Map<string, WordleGame>();

function getResultLine(guess: string, word: string): string {
  const result: string[] = [];
  const wordLetters = word.split('');

  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === word[i]) {
      result.push('🟩');
    } else if (wordLetters.includes(guess[i])) {
      result.push('🟨');
      wordLetters[wordLetters.indexOf(guess[i])] = '';
    } else {
      result.push('⬛');
    }
  }

  return result.join('');
}

function getGameDisplay(game: WordleGame, userId: string): string {
  let display = '**Wordle**\n\n';

  for (const guess of game.guesses) {
    display += `${guess.toUpperCase()} ${getResultLine(guess, game.word)}\n`;
  }

  const remainingGuesses = 6 - game.guesses.length;
  display += `\nGuesses remaining: ${remainingGuesses}/6`;

  if (game.gameOver) {
    if (game.won) {
      display += `\n\n✅ You won! The word was **${game.word.toUpperCase()}**`;
    } else {
      display += `\n\n❌ Game over! The word was **${game.word.toUpperCase()}**`;
    }
  }

  return display;
}

export default {
  data: new SlashCommandBuilder()
    .setName('wordle')
    .setDescription('Play Wordle!')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('start')
        .setDescription('Start a new Wordle game')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('guess')
        .setDescription('Make a guess')
        .addStringOption((option) =>
          option
            .setName('word')
            .setDescription('Your 5-letter guess')
            .setRequired(true)
            .setMinLength(5)
            .setMaxLength(5)
        )
    ),

  module: 'fun',
  permissionPath: 'fun.games.wordle',
  premiumFeature: 'fun.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'start') {
      const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'wordle');
      if (cooldown > 0) {
        return interaction.reply({
          content: `⏳ Wait ${cooldown}s before playing again!`,
          ephemeral: true,
        });
      }

      if (activeGames.has(interaction.user.id)) {
        return interaction.reply({
          content: '❌ You already have an active game! Use `/wordle guess` to make a guess.',
          ephemeral: true,
        });
      }

      const word = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
      const game: WordleGame = {
        word,
        guesses: [],
        gameOver: false,
        won: false,
      };

      activeGames.set(interaction.user.id, game);

      const embed = new EmbedBuilder()
        .setTitle('🎮 Wordle')
        .setDescription(getGameDisplay(game, interaction.user.id));

      await interaction.reply({
        embeds: [embed],
      });

      await setCooldown(interaction.guildId!, interaction.user.id, 'wordle', 3);
    } else if (subcommand === 'guess') {
      const game = activeGames.get(interaction.user.id);

      if (!game) {
        return interaction.reply({
          content: '❌ You don\'t have an active game! Use `/wordle start` to begin.',
          ephemeral: true,
        });
      }

      if (game.gameOver) {
        return interaction.reply({
          content: '❌ This game is already over! Use `/wordle start` for a new game.',
          ephemeral: true,
        });
      }

      const guess = interaction.options.getString('word', true).toLowerCase();

      if (!WORD_LIST.includes(guess)) {
        return interaction.reply({
          content: '❌ That word is not in the word list!',
          ephemeral: true,
        });
      }

      game.guesses.push(guess);

      if (guess === game.word) {
        game.gameOver = true;
        game.won = true;
      } else if (game.guesses.length >= 6) {
        game.gameOver = true;
        game.won = false;
      }

      const embed = new EmbedBuilder()
        .setTitle('🎮 Wordle')
        .setDescription(getGameDisplay(game, interaction.user.id));

      if (game.gameOver) {
        if (game.won) {
          embed.setColor(0x00ff00);
        } else {
          embed.setColor(0xff0000);
        }

        activeGames.delete(interaction.user.id);
      } else {
        embed.setColor(0x3498db);
      }

      await interaction.reply({
        embeds: [embed],
      });
    }
  },
  category: 'fun',
} as BotCommand;
