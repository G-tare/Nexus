import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  User,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types';
import { checkCooldown, setCooldown } from '../../helpers';


type Cell = 0 | 1 | 2;
type Board = Cell[][];

function createBoard(): Board {
  return Array(3)
    .fill(null)
    .map(() => Array(3).fill(0));
}

function checkWin(board: Board, player: 1 | 2): boolean {
  // Rows
  for (let i = 0; i < 3; i++) {
    if (board[i][0] === player && board[i][1] === player && board[i][2] === player) {
      return true;
    }
  }

  // Columns
  for (let i = 0; i < 3; i++) {
    if (board[0][i] === player && board[1][i] === player && board[2][i] === player) {
      return true;
    }
  }

  // Diagonals
  if (board[0][0] === player && board[1][1] === player && board[2][2] === player) {
    return true;
  }

  if (board[0][2] === player && board[1][1] === player && board[2][0] === player) {
    return true;
  }

  return false;
}

function isBoardFull(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell !== 0));
}

function boardToString(board: Board): string {
  const emojis = ['⬛', '❌', '⭕'];
  let result = '';

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      result += emojis[board[i][j]];
    }
    result += '\n';
  }

  return result;
}

function getBotMove(board: Board): number {
  // Check if bot can win
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[i][j] === 0) {
        board[i][j] = 2;
        if (checkWin(board, 2)) {
          board[i][j] = 0;
          return i * 3 + j;
        }
        board[i][j] = 0;
      }
    }
  }

  // Check if need to block player
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[i][j] === 0) {
        board[i][j] = 1;
        if (checkWin(board, 1)) {
          board[i][j] = 0;
          return i * 3 + j;
        }
        board[i][j] = 0;
      }
    }
  }

  // Take center
  if (board[1][1] === 0) {
    return 4;
  }

  // Take corner
  const corners = [0, 2, 6, 8];
  const availableCorners = corners.filter((pos) => {
    const i = Math.floor(pos / 3);
    const j = pos % 3;
    return board[i][j] === 0;
  });
  if (availableCorners.length > 0) {
    return availableCorners[Math.floor(Math.random() * availableCorners.length)];
  }

  // Take any available
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[i][j] === 0) {
        return i * 3 + j;
      }
    }
  }

  return -1;
}

export default {
  data: new SlashCommandBuilder()
    .setName('tictactoe')
    .setDescription('Play Tic Tac Toe!')
    .addUserOption((option) =>
      option
        .setName('opponent')
        .setDescription('The player to challenge (leave empty to play vs bot)')
        .setRequired(false)
    ),

  module: 'fun',
  permissionPath: 'fun.games.tictactoe',
  premiumFeature: 'fun.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'tictactoe');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before playing again!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const opponent = interaction.options.getUser('opponent');
    const vsBot = !opponent;

    if (opponent && opponent.id === interaction.user.id) {
      return interaction.reply({
        content: '❌ You cannot play against yourself!',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (opponent && opponent.bot && opponent.id !== interaction.client.user?.id) {
      return interaction.reply({
        content: '❌ You cannot play against another bot!',
        flags: MessageFlags.Ephemeral,
      });
    }

    const board = createBoard();
    let currentPlayer: 1 | 2 = 1;

    const createButtons = (): ActionRowBuilder<ButtonBuilder>[] => {
      const rows: ActionRowBuilder<ButtonBuilder>[] = [];

      for (let i = 0; i < 3; i++) {
        const row = new ActionRowBuilder<ButtonBuilder>();
        for (let j = 0; j < 3; j++) {
          const pos = i * 3 + j;
          const cell = board[i][j];
          const emojis = ['⬜', '❌', '⭕'];

          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`ttt_${pos}`)
              .setEmoji(emojis[cell])
              .setStyle(cell === 0 ? ButtonStyle.Secondary : ButtonStyle.Success)
              .setDisabled(cell !== 0)
          );
        }
        rows.push(row);
      }

      return rows;
    };

    const playerName = vsBot ? 'You' : opponent!.username;
    const opponentName = vsBot ? 'Bot' : interaction.user.username;

    const embed = new EmbedBuilder()
      .setTitle('❌⭕ Tic Tac Toe')
      .setDescription(
        `${interaction.user.username} (❌) vs ${vsBot ? 'Bot' : opponent!.username} (⭕)\n\n` +
          boardToString(board) +
          `\n**Current Turn:** ${
            currentPlayer === 1 ? interaction.user.username : opponentName
          }`
      );

    const message = await interaction.reply({
      embeds: [embed],
      components: createButtons(),
      fetchReply: true,
    });

    const collector = message.createMessageComponentCollector({
      time: 60000,
    });

    let gameOver = false;

    const makePlayerMove = async (pos: number, isBot: boolean) => {
      const i = Math.floor(pos / 3);
      const j = pos % 3;

      if (board[i][j] !== 0) {
        return false;
      }

      board[i][j] = currentPlayer;
      return true;
    };

    collector.on('collect', async (buttonInteraction: ButtonInteraction) => {
      if (vsBot && currentPlayer === 2) {
        return buttonInteraction.reply({
          content: '❌ It\'s the bot\'s turn!',
          flags: MessageFlags.Ephemeral,
        });
      }

      if (!vsBot && buttonInteraction.user.id !== (currentPlayer === 1 ? interaction.user.id : opponent!.id)) {
        return buttonInteraction.reply({
          content: '❌ It\'s not your turn!',
          flags: MessageFlags.Ephemeral,
        });
      }

      const pos = parseInt(buttonInteraction.customId.split('_')[1]);
      const i = Math.floor(pos / 3);
      const j = pos % 3;

      if (board[i][j] !== 0) {
        return buttonInteraction.reply({
          content: '❌ That cell is already taken!',
          flags: MessageFlags.Ephemeral,
        });
      }

      board[i][j] = currentPlayer;

      if (checkWin(board, currentPlayer)) {
        const winner = currentPlayer === 1 ? interaction.user.username : opponentName;

        const winEmbed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('🎉 Game Over!')
          .setDescription(
            `${winner} (${currentPlayer === 1 ? '❌' : '⭕'}) wins!\n\n` +
              boardToString(board)
          );

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
          .setDescription(`The board is full!\n\n${boardToString(board)}`);

        await buttonInteraction.update({
          embeds: [drawEmbed],
          components: [],
        });
        collector.stop();
        gameOver = true;
      } else {
        currentPlayer = currentPlayer === 1 ? 2 : 1;

        // Bot move
        if (vsBot && currentPlayer === 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000));

          const botMove = getBotMove(board);
          if (botMove !== -1) {
            const bi = Math.floor(botMove / 3);
            const bj = botMove % 3;
            board[bi][bj] = 2;

            if (checkWin(board, 2)) {
              const botWinEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('🎉 Game Over!')
                .setDescription(
                  `Bot (⭕) wins!\n\n${boardToString(board)}`
                );

              await message.edit({
                embeds: [botWinEmbed],
                components: [],
              });
              collector.stop();
              gameOver = true;
              return;
            } else if (isBoardFull(board)) {
              const botDrawEmbed = new EmbedBuilder()
                .setColor(0xffff00)
                .setTitle('🤝 Draw!')
                .setDescription(`The board is full!\n\n${boardToString(board)}`);

              await message.edit({
                embeds: [botDrawEmbed],
                components: [],
              });
              collector.stop();
              gameOver = true;
              return;
            }
          }

          currentPlayer = 1;
        }

        const nextEmbed = new EmbedBuilder()
          .setTitle('❌⭕ Tic Tac Toe')
          .setDescription(
            `${interaction.user.username} (❌) vs ${vsBot ? 'Bot' : opponent!.username} (⭕)\n\n` +
              boardToString(board) +
              `\n**Current Turn:** ${
                currentPlayer === 1 ? interaction.user.username : opponentName
              }`
          );

        await buttonInteraction.update({
          embeds: [nextEmbed],
          components: createButtons(),
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

    await setCooldown(interaction.guildId!, interaction.user.id, 'tictactoe', 3);
  },
  category: 'fun',
} as BotCommand;
