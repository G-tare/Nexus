import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  User,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types';
import {
  checkCooldown,
  setCooldown,
  placeBet,
  awardWinnings,
  emitGameWon,
  emitGameLost,
  getFunConfig,
} from '../../helpers';


type Cell = 0 | 1 | 2;
type Board = Cell[][];

function createBoard(): Board {
  return Array(6)
    .fill(null)
    .map(() => Array(7).fill(0));
}

function canPlaceInColumn(board: Board, col: number): boolean {
  return board[0][col] === 0;
}

function placeDisc(board: Board, col: number, player: 1 | 2): boolean {
  for (let row = 5; row >= 0; row--) {
    if (board[row][col] === 0) {
      board[row][col] = player;
      return true;
    }
  }
  return false;
}

function checkWin(board: Board, player: 1 | 2): boolean {
  // Horizontal
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 4; col++) {
      if (
        board[row][col] === player &&
        board[row][col + 1] === player &&
        board[row][col + 2] === player &&
        board[row][col + 3] === player
      ) {
        return true;
      }
    }
  }

  // Vertical
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row < 3; row++) {
      if (
        board[row][col] === player &&
        board[row + 1][col] === player &&
        board[row + 2][col] === player &&
        board[row + 3][col] === player
      ) {
        return true;
      }
    }
  }

  // Diagonal (top-left to bottom-right)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      if (
        board[row][col] === player &&
        board[row + 1][col + 1] === player &&
        board[row + 2][col + 2] === player &&
        board[row + 3][col + 3] === player
      ) {
        return true;
      }
    }
  }

  // Diagonal (top-right to bottom-left)
  for (let row = 0; row < 3; row++) {
    for (let col = 3; col < 7; col++) {
      if (
        board[row][col] === player &&
        board[row + 1][col - 1] === player &&
        board[row + 2][col - 2] === player &&
        board[row + 3][col - 3] === player
      ) {
        return true;
      }
    }
  }

  return false;
}

function isBoardFull(board: Board): boolean {
  return board[0].every((cell) => cell !== 0);
}

function boardToString(board: Board, p1: User, p2: User): string {
  const p1Emoji = '🔴';
  const p2Emoji = '🟡';
  const emptyEmoji = '⚫';

  let result = '';

  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      const cell = board[row][col];
      if (cell === 1) result += p1Emoji;
      else if (cell === 2) result += p2Emoji;
      else result += emptyEmoji;
    }
    result += '\n';
  }

  result += '1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣';
  return result;
}

export default {
  data: new SlashCommandBuilder()
    .setName('connect4')
    .setDescription('Play Connect 4 against another player!')
    .addUserOption((option) =>
      option
        .setName('opponent')
        .setDescription('The player to challenge')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('bet')
        .setDescription('Amount to bet (optional, both players bet)')
        .setRequired(false)
        .setMinValue(1)
    ),

  module: 'fun',
  permissionPath: 'fun.games.connect4',
  premiumFeature: 'fun.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'connect4');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before playing again!`,
        ephemeral: true,
      });
    }

    const opponent = interaction.options.getUser('opponent', true);
    const bet = interaction.options.getInteger('bet');

    if (opponent.id === interaction.user.id) {
      return interaction.reply({
        content: '❌ You cannot play against yourself!',
        ephemeral: true,
      });
    }

    if (opponent.bot) {
      return interaction.reply({
        content: '❌ You cannot play against a bot!',
        ephemeral: true,
      });
    }

    if (bet && bet > 0) {
      const config = await getFunConfig(interaction.guildId!);
      const p1BetResult = await placeBet(interaction.guildId!, interaction.user.id, bet, config);
      const p2BetResult = await placeBet(interaction.guildId!, opponent.id, bet, config);

      if (!p1BetResult.success || !p2BetResult.success) {
        return interaction.reply({
          content: '❌ One or both players have insufficient currency!',
          ephemeral: true,
        });
      }
    }

    const board = createBoard();
    let currentPlayer: 1 | 2 = 1;

    const createButtons = (): ActionRowBuilder<ButtonBuilder> => {
      return new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...Array(7)
          .fill(null)
          .map((_, i) =>
            new ButtonBuilder()
              .setCustomId(`c4_col_${i}`)
              .setLabel((i + 1).toString())
              .setStyle(canPlaceInColumn(board, i) ? ButtonStyle.Primary : ButtonStyle.Secondary)
              .setDisabled(!canPlaceInColumn(board, i))
          )
      );
    };

    const embed = new EmbedBuilder()
      .setTitle('🔴🟡 Connect 4')
      .setDescription(
        `${interaction.user.username} (🔴) vs ${opponent.username} (🟡)\n\n` +
          boardToString(board, interaction.user, opponent) +
          `\n\n**Current Turn:** ${
            currentPlayer === 1 ? interaction.user.username : opponent.username
          }`
      );

    if (bet && bet > 0) {
      embed.addFields({
        name: 'Bet',
        value: `${bet} per player`,
        inline: false,
      });
    }

    const message = await interaction.reply({
      embeds: [embed],
      components: [createButtons()],
      fetchReply: true,
    });

    const collector = message.createMessageComponentCollector({
      time: 60000,
    });

    let gameOver = false;

    collector.on('collect', async (buttonInteraction: ButtonInteraction) => {
      const currentPlayerUser =
        currentPlayer === 1 ? interaction.user : opponent;

      if (buttonInteraction.user.id !== currentPlayerUser.id) {
        return buttonInteraction.reply({
          content: '❌ It\'s not your turn!',
          ephemeral: true,
        });
      }

      const col = parseInt(buttonInteraction.customId.split('_')[2]);

      if (!placeDisc(board, col, currentPlayer)) {
        return buttonInteraction.reply({
          content: '❌ Column is full!',
          ephemeral: true,
        });
      }

      if (checkWin(board, currentPlayer)) {
        const winner = currentPlayer === 1 ? interaction.user : opponent;
        const loser = currentPlayer === 1 ? opponent : interaction.user;

        if (bet && bet > 0) {
          const winnings = bet * 2;
          await awardWinnings(interaction.guildId!, winner.id, winnings);
          emitGameWon(interaction.guildId!, winner.id, 'connect4', bet, winnings);
          emitGameLost(interaction.guildId!, loser.id, 'connect4', bet);
        }

        const winEmbed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('🎉 Game Over!')
          .setDescription(
            `${winner.username} (${currentPlayer === 1 ? '🔴' : '🟡'}) wins!\n\n` +
              boardToString(board, interaction.user, opponent)
          );

        if (bet && bet > 0) {
          const winnings = bet * 2;
          winEmbed.addFields({
            name: 'Winnings',
            value: `${winner.username} +${winnings}`,
            inline: false,
          });
        }

        await buttonInteraction.update({
          embeds: [winEmbed],
          components: [],
        });
        collector.stop();
        gameOver = true;
      } else if (isBoardFull(board)) {
        const drawEmbed = new EmbedBuilder()
          .setColor(0xffff00)
          .setTitle('🤝 Draw!')
          .setDescription(
            `The board is full!\n\n` + boardToString(board, interaction.user, opponent)
          );

        await buttonInteraction.update({
          embeds: [drawEmbed],
          components: [],
        });
        collector.stop();
        gameOver = true;
      } else {
        currentPlayer = currentPlayer === 1 ? 2 : 1;

        const nextEmbed = new EmbedBuilder()
          .setTitle('🔴🟡 Connect 4')
          .setDescription(
            `${interaction.user.username} (🔴) vs ${opponent.username} (🟡)\n\n` +
              boardToString(board, interaction.user, opponent) +
              `\n\n**Current Turn:** ${currentPlayer === 1 ? interaction.user.username : opponent.username}`
          );

        if (bet && bet > 0) {
          nextEmbed.addFields({
            name: 'Bet',
            value: `${bet} per player`,
            inline: false,
          });
        }

        await buttonInteraction.update({
          embeds: [nextEmbed],
          components: [createButtons()],
        });
      }
    });

    collector.on('end', async (collected) => {
      if (!gameOver) {
        await message.edit({
          content: '⏱️ Game ended due to inactivity.',
          components: [],
        });
      }
    });

    await setCooldown(interaction.guildId!, interaction.user.id, 'connect4', 5);
  },
  category: 'fun',
} as BotCommand;
