import {
  SlashCommandBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { checkCooldown, setCooldown, shuffleArray } from '../../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../../Shared/src/utils/componentsV2';

const NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '⬜'];

interface PuzzleState {
  tiles: string[];
  moves: number;
}

export default {
  data: new SlashCommandBuilder()
    .setName('puzzle')
    .setDescription('Solve the 3x3 sliding puzzle'),

  module: 'fun',
  permissionPath: 'fun.games.puzzle',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'puzzle');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before playing again!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const tiles = shuffleArray([...NUMBERS]);
    const state: PuzzleState = { tiles, moves: 0 };

    const renderGrid = (tiles: string[]) => {
      let grid = '';
      for (let i = 0; i < 9; i++) {
        if (i > 0 && i % 3 === 0) grid += '\n';
        grid += tiles[i];
      }
      return grid;
    };

    const checkWin = (tiles: string[]) => {
      for (let i = 0; i < 8; i++) {
        if (tiles[i] !== NUMBERS[i]) return false;
      }
      return tiles[8] === '⬜';
    };

    const buildContainer = () => {
      const container = moduleContainer('fun');
      addText(container, '### Number Puzzle');
      addText(container, renderGrid(state.tiles));
      addFields(container, [{ name: 'Moves', value: String(state.moves) }]);
      addText(container, '-# Click arrows to move tiles');
      return container;
    };

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('up')
          .setLabel('⬆️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('down')
          .setLabel('⬇️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('left')
          .setLabel('⬅️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('right')
          .setLabel('➡️')
          .setStyle(ButtonStyle.Secondary)
      );

    const container = buildContainer();
    container.addActionRowComponents(row);
    const msg = await interaction.reply({ ...v2Payload([container]), fetchReply: true });

    const collector = msg.createMessageComponentCollector({ time: 300000 });

    const moveTile = (direction: string) => {
      const emptyIndex = state.tiles.indexOf('⬜');
      let newIndex = -1;

      if (direction === 'up' && emptyIndex >= 3) newIndex = emptyIndex - 3;
      else if (direction === 'down' && emptyIndex < 6) newIndex = emptyIndex + 3;
      else if (direction === 'left' && emptyIndex % 3 !== 0) newIndex = emptyIndex - 1;
      else if (direction === 'right' && emptyIndex % 3 !== 2) newIndex = emptyIndex + 1;

      if (newIndex !== -1) {
        [state.tiles[emptyIndex], state.tiles[newIndex]] = [state.tiles[newIndex], state.tiles[emptyIndex]];
        state.moves++;
      }
    };

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({ content: 'Not your game!', flags: MessageFlags.Ephemeral });
        return;
      }

      if (['up', 'down', 'left', 'right'].includes(buttonInteraction.customId)) {
        moveTile(buttonInteraction.customId);

        if (checkWin(state.tiles)) {
          const winContainer = buildContainer();
          addText(winContainer, '### You Won!');
          await interaction.editReply(v2Payload([winContainer]));
          collector.stop();
        } else {
          const newContainer = buildContainer();
          newContainer.addActionRowComponents(row);
          await interaction.editReply(v2Payload([newContainer]));
        }
      }

      await buttonInteraction.deferUpdate();
    });

    await setCooldown(interaction.guildId!, interaction.user.id, 'puzzle', 3);
  },
} as BotCommand;
