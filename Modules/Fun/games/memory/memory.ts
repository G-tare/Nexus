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
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { checkCooldown, setCooldown, shuffleArray } from '../../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../../Shared/src/utils/componentsV2';

const EMOJIS = ['🎮', '🎯', '🎵', '🌟', '🎪', '🎨', '🔮', '🎲'];

export default {
  data: new SlashCommandBuilder()
    .setName('memory')
    .setDescription('Match memory pairs'),

  module: 'fun',
  permissionPath: 'fun.games.memory',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'memory');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before playing again!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const grid = shuffleArray([...EMOJIS, ...EMOJIS]);
    const revealed: boolean[] = new Array(16).fill(false);
    const matched: boolean[] = new Array(16).fill(false);
    let moves = 0;
    let lastClick: number | null = null;
    let gameOver = false;

    const buildContainer = () => {
      let gridStr = '';
      for (let i = 0; i < 16; i++) {
        if (i > 0 && i % 4 === 0) gridStr += '\n';
        if (matched[i]) {
          gridStr += '✅ ';
        } else if (revealed[i]) {
          gridStr += `${grid[i]} `;
        } else {
          gridStr += '⬜ ';
        }
      }
      const container = moduleContainer('fun');
      addText(container, '### Memory Match');
      addText(container, gridStr);
      addFields(container, [{ name: 'Moves', value: String(moves) }]);
      if (gameOver) {
        addText(container, '-# You won!');
      } else {
        addText(container, '-# Click cells 1-16');
      }
      return container;
    };

    const msg = await interaction.reply({ ...v2Payload([buildContainer()]), fetchReply: true });

    const handleCellClick = async (cellNum: number) => {
      if (matched[cellNum] || revealed[cellNum] || gameOver) return;

      revealed[cellNum] = true;

      if (lastClick === null) {
        lastClick = cellNum;
        await interaction.editReply(v2Payload([buildContainer()]));
      } else {
        moves++;
        const firstCell = lastClick;
        lastClick = null;

        await interaction.editReply(v2Payload([buildContainer()]));

        if (grid[firstCell] === grid[cellNum]) {
          matched[firstCell] = true;
          matched[cellNum] = true;

          const remainingPairs = matched.filter((m) => !m).length / 2;
          if (remainingPairs === 0) {
            gameOver = true;
            await interaction.editReply(v2Payload([buildContainer()]));
          }
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          revealed[firstCell] = false;
          revealed[cellNum] = false;
          await interaction.editReply(v2Payload([buildContainer()]));
        }
      }
    };

    const collector = msg.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({ content: 'Not your game!', flags: MessageFlags.Ephemeral });
        return;
      }

      if (gameOver) {
        await buttonInteraction.reply({ content: 'Game is over!', flags: MessageFlags.Ephemeral });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('memory_modal')
        .setTitle('Pick a cell (1-16)');

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('cell_input')
            .setLabel('Cell number')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(2)
            .setRequired(true)
        )
      );

      await buttonInteraction.showModal(modal);

      try {
        const modalSubmit = await buttonInteraction.awaitModalSubmit({ time: 60000 });
        const cellNum = parseInt(modalSubmit.fields.getTextInputValue('cell_input')) - 1;

        if (isNaN(cellNum) || cellNum < 0 || cellNum > 15) {
          await modalSubmit.reply({ content: 'Please enter a number between 1-16!', flags: MessageFlags.Ephemeral });
          return;
        }

        await handleCellClick(cellNum);
        await modalSubmit.deferUpdate();
      } catch (error) {
        console.error('Modal timeout:', error);
      }
    });

    await setCooldown(interaction.guildId!, interaction.user.id, 'memory', 3);
  },
} as BotCommand;
