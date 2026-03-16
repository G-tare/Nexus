import {
  SlashCommandBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import {
  getCasinoConfig,
  placeBet,
  awardWinnings,
  logCasinoGame,
  checkCooldown,
  setCooldown,
  getRandomElement,
} from '../helpers';
import {
  moduleContainer,
  successContainer,
  errorContainer,
  addText,
  addFields,
  addButtons,
  addSeparator,
  addFooter,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🔔', '⭐', '💎', '7️⃣'];

const command: BotCommand = {
  module: 'casino',
  permissionPath: 'casino.scratchcard',
  data: new SlashCommandBuilder()
    .setName('scratchcard')
    .setDescription('Scratch a lucky card!')
    .addIntegerOption((opt) =>
      opt
        .setName('bet')
        .setDescription('Amount to bet')
        .setRequired(true)
        .setMinValue(1)
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {

    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const betAmount = interaction.options.getInteger('bet')!;

    // Check cooldown
    const hasCooldown = await checkCooldown(guildId, userId, 'scratchcard');
    if (!hasCooldown) {
      await interaction.reply({
        content: 'You are on cooldown for scratch card.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Get config
    const config = await getCasinoConfig(guildId);

    // Place bet
    const betResult = await placeBet(guildId, userId, betAmount, config);
    if (!betResult.success) {
      await interaction.reply({
        content: betResult.error || 'Failed to place bet',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();

    // Generate card
    const card = [
      Array(3)
        .fill(0)
        .map(() => getRandomElement(SYMBOLS)),
      Array(3)
        .fill(0)
        .map(() => getRandomElement(SYMBOLS)),
      Array(3)
        .fill(0)
        .map(() => getRandomElement(SYMBOLS)),
    ];

    const scratched = [[false, false, false], [false, false, false], [false, false, false]];

    const initialContainer = buildScratchContainer(card, scratched, betAmount);
    const scratch0Btn = new ButtonBuilder()
      .setCustomId('scratch_0')
      .setLabel('Scratch Row 1')
      .setStyle(ButtonStyle.Primary);
    const scratch1Btn = new ButtonBuilder()
      .setCustomId('scratch_1')
      .setLabel('Scratch Row 2')
      .setStyle(ButtonStyle.Primary);
    const scratch2Btn = new ButtonBuilder()
      .setCustomId('scratch_2')
      .setLabel('Scratch Row 3')
      .setStyle(ButtonStyle.Primary);

    addButtons(initialContainer, [scratch0Btn, scratch1Btn, scratch2Btn]);

    const message = await interaction.editReply(v2Payload([initialContainer]));

    const collector = message.createMessageComponentCollector({
      time: 60000,
    });

    let scratchesUsed = 0;
    const maxScratches = 3;

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.user.id !== userId) {
        await buttonInteraction.reply({
          content: 'This is not your game.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const rowIndex = parseInt(buttonInteraction.customId.split('_')[1], 10);

      // Mark row as scratched
      scratched[rowIndex] = [true, true, true];
      scratchesUsed++;

      // Check for win
      const { multiplier, description } = checkScratchWin(card, scratched);

      let result: 'win' | 'loss' = 'loss';
      let winAmount = 0;

      if (scratchesUsed >= maxScratches) {
        // Game over
        const allScratched = true;

        if (multiplier > 0) {
          result = 'win';
          winAmount = Math.floor(betAmount * multiplier);
          await awardWinnings(guildId, userId, winAmount);
        }

        const finalContainer = result === 'win'
          ? successContainer('Scratch Card Result', `${description}\n\nBet: ${betAmount}\nWin: ${winAmount}\nMultiplier: ${multiplier}x`)
          : errorContainer('Scratch Card Result', `${description}\n\nBet: ${betAmount}\nWin: ${winAmount}\nMultiplier: ${multiplier}x`);

        addSeparator(finalContainer, 'small');
        addFields(finalContainer, [{
          name: 'Card',
          value: `${card[0].join('')}\n${card[1].join('')}\n${card[2].join('')}`,
          inline: false,
        }]);
        addFooter(finalContainer, 'Scratch Card Game');

        await buttonInteraction.update(v2Payload([finalContainer]));

        await logCasinoGame(
          guildId,
          userId,
          'scratchcard',
          betAmount,
          winAmount,
          multiplier,
          result,
          { card }
        );

        collector.stop();
      } else {
        // Continue scratching
        const currentContainer = buildScratchContainer(card, scratched, betAmount);

        const btn0 = new ButtonBuilder()
          .setCustomId('scratch_0')
          .setLabel(`Scratch Row 1${scratched[0][0] ? ' ✅' : ''}`)
          .setStyle(scratched[0][0] ? ButtonStyle.Success : ButtonStyle.Primary)
          .setDisabled(scratched[0][0]);
        const btn1 = new ButtonBuilder()
          .setCustomId('scratch_1')
          .setLabel(`Scratch Row 2${scratched[1][0] ? ' ✅' : ''}`)
          .setStyle(scratched[1][0] ? ButtonStyle.Success : ButtonStyle.Primary)
          .setDisabled(scratched[1][0]);
        const btn2 = new ButtonBuilder()
          .setCustomId('scratch_2')
          .setLabel(`Scratch Row 3${scratched[2][0] ? ' ✅' : ''}`)
          .setStyle(scratched[2][0] ? ButtonStyle.Success : ButtonStyle.Primary)
          .setDisabled(scratched[2][0]);

        addButtons(currentContainer, [btn0, btn1, btn2]);

        await buttonInteraction.update(v2Payload([currentContainer]));
      }
    });

    collector.on('end', async () => {
      try {
        await message.edit({ components: [] });
      } catch {
        // Message already deleted
      }
    });

    // Set cooldown
    await setCooldown(guildId, userId, 'scratchcard', config.cooldown);
  },
};

function buildScratchContainer(
  card: string[][],
  scratched: boolean[][],
  betAmount: number
) {
  const displayCard = card.map((row, rowIdx) =>
    row
      .map((symbol, colIdx) => (scratched[rowIdx][colIdx] ? symbol : '⬛'))
      .join('')
  );

  const container = moduleContainer('casino');
  addText(container, `### 🎫 Scratch Card`);
  addSeparator(container, 'small');
  addText(container, `${displayCard[0]}\n${displayCard[1]}\n${displayCard[2]}\n\nScratch cards to reveal symbols!`);
  addFields(container, [{ name: 'Bet', value: `${betAmount}`, inline: true }]);
  addFooter(container, 'Scratch Card Game');

  return container;
}

function checkScratchWin(
  card: string[][],
  scratched: boolean[][]
): { multiplier: number; description: string } {
  // Check if all scratches are done
  const allScratched = scratched.every((row) => row.every((cell) => cell));
  if (!allScratched) {
    return { multiplier: 0, description: 'Keep scratching...' };
  }

  // Check each row for matches (same logic as slots)
  for (let i = 0; i < 3; i++) {
    if (card[i][0] === card[i][1] && card[i][1] === card[i][2]) {
      const symbol = card[i][0];

      if (symbol === '7️⃣') return { multiplier: 50, description: '🎉 TRIPLE SEVENS! 50x WIN!' };
      if (symbol === '💎')
        return { multiplier: 25, description: '💎 TRIPLE DIAMONDS! 25x WIN!' };
      if (symbol === '⭐') return { multiplier: 15, description: '⭐ TRIPLE STARS! 15x WIN!' };
      if (symbol === '🔔') return { multiplier: 10, description: '🔔 TRIPLE BELLS! 10x WIN!' };
      return { multiplier: 5, description: '🍒 TRIPLE MATCH! 5x WIN!' };
    }
  }

  return { multiplier: 0, description: 'No matching rows. Better luck next time!' };
}

export default command;
