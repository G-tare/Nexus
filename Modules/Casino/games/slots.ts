import {
  SlashCommandBuilder,
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
  sleep,
} from '../helpers';
import {
  moduleContainer,
  addText,
  addFields,
  addSeparator,
  addFooter,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🔔', '⭐', '💎', '7️⃣'];

const command: BotCommand = {
  module: 'casino',
  permissionPath: 'casino.slots',
  data: new SlashCommandBuilder()
    .setName('casino-slots')
    .setDescription('Spin the slot machine')
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
    const hasCooldown = await checkCooldown(guildId, userId, 'slots');
    if (!hasCooldown) {
      await interaction.reply({
        content: 'You are on cooldown for slots.',
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

    // Spinning animation
    const spinningContainer = buildSlotsContainer(
      Array(3).fill('🎰'),
      Array(3).fill('🎰'),
      Array(3).fill('🎰'),
      'Spinning...'
    );

    const message = await interaction.editReply(v2Payload([spinningContainer]));

    // Animate spin
    for (let i = 0; i < 3; i++) {
      await sleep(300);
      const row1 = Array(3)
        .fill(0)
        .map(() => getRandomElement(SYMBOLS));
      const row2 = Array(3)
        .fill(0)
        .map(() => getRandomElement(SYMBOLS));
      const row3 = Array(3)
        .fill(0)
        .map(() => getRandomElement(SYMBOLS));

      const spinContainer = buildSlotsContainer(row1, row2, row3, 'Spinning...');
      await message.edit(v2Payload([spinContainer]));
    }

    // Final result
    const row1 = Array(3)
      .fill(0)
      .map(() => getRandomElement(SYMBOLS));
    const row2 = Array(3)
      .fill(0)
      .map(() => getRandomElement(SYMBOLS));
    const row3 = Array(3)
      .fill(0)
      .map(() => getRandomElement(SYMBOLS));

    // Check for wins
    const { multiplier, description } = checkSlotsWin(row1, row2, row3);

    let result: 'win' | 'loss' = 'loss';
    let winAmount = 0;

    if (multiplier > 0) {
      result = 'win';
      winAmount = Math.floor(betAmount * multiplier);
      await awardWinnings(guildId, userId, winAmount);
    }

    const finalContainer = buildSlotsContainer(
      row1,
      row2,
      row3,
      description
    );
    addSeparator(finalContainer, 'small');
    addFields(finalContainer, [
      { name: 'Bet', value: `${betAmount}`, inline: true },
      { name: 'Win Amount', value: `${winAmount}`, inline: true },
      { name: 'Multiplier', value: `${multiplier}x`, inline: true }
    ]);

    await message.edit(v2Payload([finalContainer]));

    await logCasinoGame(
      guildId,
      userId,
      'slots',
      betAmount,
      winAmount,
      multiplier,
      result,
      { row1, row2, row3 }
    );

    // Set cooldown
    await setCooldown(guildId, userId, 'slots', config.cooldown);
  },
};

function buildSlotsContainer(
  row1: string[],
  row2: string[],
  row3: string[],
  status: string
) {
  const grid = `${row1.join('')}\n${row2.join('')}\n${row3.join('')}`;

  const container = moduleContainer('casino');
  addText(container, `### 🎰 Slots`);
  addSeparator(container, 'small');
  addText(container, `\`\`\`\n${grid}\n\`\`\`\n${status}`);
  addFooter(container, 'Slot Machine Game');

  return container;
}

function checkSlotsWin(
  row1: string[],
  row2: string[],
  row3: string[]
): { multiplier: number; description: string } {
  // Check center row (most common)
  if (row2[0] === row2[1] && row2[1] === row2[2]) {
    const symbol = row2[0];

    if (symbol === '7️⃣') return { multiplier: 50, description: '🎉 TRIPLE SEVENS! 50x WIN!' };
    if (symbol === '💎') return { multiplier: 25, description: '💎 TRIPLE DIAMONDS! 25x WIN!' };
    if (symbol === '⭐') return { multiplier: 15, description: '⭐ TRIPLE STARS! 15x WIN!' };
    if (symbol === '🔔') return { multiplier: 10, description: '🔔 TRIPLE BELLS! 10x WIN!' };
    return { multiplier: 5, description: '🍒 TRIPLE MATCH! 5x WIN!' };
  }

  // Check top row
  if (row1[0] === row1[1] && row1[1] === row1[2]) {
    const symbol = row1[0];
    if (symbol === '7️⃣') return { multiplier: 50, description: '🎉 TRIPLE SEVENS! 50x WIN!' };
    if (symbol === '💎') return { multiplier: 25, description: '💎 TRIPLE DIAMONDS! 25x WIN!' };
    if (symbol === '⭐') return { multiplier: 15, description: '⭐ TRIPLE STARS! 15x WIN!' };
    if (symbol === '🔔') return { multiplier: 10, description: '🔔 TRIPLE BELLS! 10x WIN!' };
    return { multiplier: 5, description: '🍒 TRIPLE MATCH! 5x WIN!' };
  }

  // Check bottom row
  if (row3[0] === row3[1] && row3[1] === row3[2]) {
    const symbol = row3[0];
    if (symbol === '7️⃣') return { multiplier: 50, description: '🎉 TRIPLE SEVENS! 50x WIN!' };
    if (symbol === '💎') return { multiplier: 25, description: '💎 TRIPLE DIAMONDS! 25x WIN!' };
    if (symbol === '⭐') return { multiplier: 15, description: '⭐ TRIPLE STARS! 15x WIN!' };
    if (symbol === '🔔') return { multiplier: 10, description: '🔔 TRIPLE BELLS! 10x WIN!' };
    return { multiplier: 5, description: '🍒 TRIPLE MATCH! 5x WIN!' };
  }

  // Check diagonals
  if (row1[0] === row2[1] && row2[1] === row3[2]) {
    const symbol = row1[0];
    if (symbol === '7️⃣') return { multiplier: 50, description: '🎉 DIAGONAL SEVENS! 50x WIN!' };
    if (symbol === '💎') return { multiplier: 25, description: '💎 DIAGONAL DIAMONDS! 25x WIN!' };
    if (symbol === '⭐') return { multiplier: 15, description: '⭐ DIAGONAL STARS! 15x WIN!' };
    if (symbol === '🔔') return { multiplier: 10, description: '🔔 DIAGONAL BELLS! 10x WIN!' };
    return { multiplier: 5, description: '🍒 DIAGONAL MATCH! 5x WIN!' };
  }

  if (row1[2] === row2[1] && row2[1] === row3[0]) {
    const symbol = row1[2];
    if (symbol === '7️⃣') return { multiplier: 50, description: '🎉 DIAGONAL SEVENS! 50x WIN!' };
    if (symbol === '💎') return { multiplier: 25, description: '💎 DIAGONAL DIAMONDS! 25x WIN!' };
    if (symbol === '⭐') return { multiplier: 15, description: '⭐ DIAGONAL STARS! 15x WIN!' };
    if (symbol === '🔔') return { multiplier: 10, description: '🔔 DIAGONAL BELLS! 10x WIN!' };
    return { multiplier: 5, description: '🍒 DIAGONAL MATCH! 5x WIN!' };
  }

  // Check for any two matching
  const allSymbols = [...row1, ...row2, ...row3];
  for (const symbol of SYMBOLS) {
    const count = allSymbols.filter((s) => s === symbol).length;
    if (count >= 2) {
      return { multiplier: 2, description: `Two ${symbol} matched! 2x WIN!` };
    }
  }

  return { multiplier: 0, description: 'No match. Better luck next time!' };
}

export default command;
