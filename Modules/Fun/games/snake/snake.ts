import {
  SlashCommandBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { checkCooldown, setCooldown } from '../../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../../Shared/src/utils/componentsV2';

interface Position {
  x: number;
  y: number;
}

export default {
  data: new SlashCommandBuilder()
    .setName('snake')
    .setDescription('Play Snake game'),

  module: 'fun',
  permissionPath: 'fun.games.snake',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'snake');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before playing again!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const SIZE = 11;
    let snake: Position[] = [{ x: 5, y: 5 }];
    let apple: Position = { x: Math.floor(Math.random() * SIZE), y: Math.floor(Math.random() * SIZE) };
    let direction = 'right';
    let nextDirection = 'right';
    let score = 0;
    let gameOver = false;

    const renderGrid = () => {
      let grid = '';
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          if (x === apple.x && y === apple.y) {
            grid += '🍎';
          } else if (snake[0].x === x && snake[0].y === y) {
            grid += '🟦';
          } else if (snake.some((s) => s.x === x && s.y === y)) {
            grid += '🔵';
          } else if (x === 0 || x === SIZE - 1 || y === 0 || y === SIZE - 1) {
            grid += '⬛';
          } else {
            grid += '⬜';
          }
        }
        grid += '\n';
      }
      return grid;
    };

    const buildContainer = () => {
      const container = moduleContainer('fun');
      addText(container, '### Snake Game');
      addText(container, renderGrid());
      addFields(container, [{ name: 'Score', value: String(score) }]);
      if (gameOver) {
        addText(container, '-# Game Over!');
      } else {
        addText(container, '-# Use direction buttons');
      }
      return container;
    };

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('up')
          .setLabel('⬆️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('down')
          .setLabel('⬇️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('left')
          .setLabel('⬅️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('right')
          .setLabel('➡️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('quit')
          .setLabel('❌')
          .setStyle(ButtonStyle.Danger)
      );

    const container = buildContainer();
    container.addActionRowComponents(row);
    const msg = await interaction.reply({ ...v2Payload([container]), fetchReply: true });

    const collector = msg.createMessageComponentCollector({ time: 120000 });

    const gameLoop = setInterval(() => {
      if (gameOver) {
        clearInterval(gameLoop);
        return;
      }

      direction = nextDirection;

      let head = { ...snake[0] };
      if (direction === 'up') head.y--;
      if (direction === 'down') head.y++;
      if (direction === 'left') head.x--;
      if (direction === 'right') head.x++;

      if (head.x <= 0 || head.x >= SIZE - 1 || head.y <= 0 || head.y >= SIZE - 1 || snake.some((s) => s.x === head.x && s.y === head.y)) {
        gameOver = true;
        clearInterval(gameLoop);
        interaction.editReply(v2Payload([buildContainer()]));
        return;
      }

      snake.unshift(head);

      if (head.x === apple.x && head.y === apple.y) {
        score++;
        apple = { x: Math.floor(Math.random() * (SIZE - 2)) + 1, y: Math.floor(Math.random() * (SIZE - 2)) + 1 };
      } else {
        snake.pop();
      }

      const newContainer = buildContainer();
      newContainer.addActionRowComponents(row);
      interaction.editReply(v2Payload([newContainer]));
    }, 500);

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({ content: 'This is not your game!', flags: MessageFlags.Ephemeral });
        return;
      }

      if (buttonInteraction.customId === 'quit') {
        gameOver = true;
        clearInterval(gameLoop);
        await buttonInteraction.deferUpdate();
        await interaction.editReply({ components: [] });
        return;
      }

      if (['up', 'down', 'left', 'right'].includes(buttonInteraction.customId)) {
        const newDir = buttonInteraction.customId;
        if ((direction === 'up' && newDir !== 'down') || (direction === 'down' && newDir !== 'up') || (direction === 'left' && newDir !== 'right') || (direction === 'right' && newDir !== 'left')) {
          nextDirection = newDir;
        }
      }

      await buttonInteraction.deferUpdate();
    });

    collector.on('end', () => {
      clearInterval(gameLoop);
    });

    await setCooldown(interaction.guildId!, interaction.user.id, 'snake', 3);
  },
} as BotCommand;
