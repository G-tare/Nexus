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
  getRandomNumber,
  sleep,
} from '../helpers';
import {
  moduleContainer,
  successContainer,
  errorContainer,
  addText,
  addFooter,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';

type BetType = 'red' | 'black' | 'odd' | 'even' | 'high' | 'low' | 'number';

const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

const command: BotCommand = {
  module: 'casino',
  permissionPath: 'casino.roulette',
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('Spin the roulette wheel')
    .addIntegerOption((opt) =>
      opt
        .setName('bet')
        .setDescription('Amount to bet')
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption((opt) =>
      opt
        .setName('type')
        .setDescription('Type of bet')
        .setRequired(true)
        .addChoices(
          { name: 'Red', value: 'red' },
          { name: 'Black', value: 'black' },
          { name: 'Odd', value: 'odd' },
          { name: 'Even', value: 'even' },
          { name: 'High (19-36)', value: 'high' },
          { name: 'Low (1-18)', value: 'low' },
          { name: 'Number (0-36)', value: 'number' }
        )
    )
    .addIntegerOption((opt) =>
      opt
        .setName('number')
        .setDescription('Number to bet on (0-36, required for number bets)')
        .setMinValue(0)
        .setMaxValue(36)
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {

    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const betAmount = interaction.options.getInteger('bet')!;
    const betType = interaction.options.getString('type') as BetType;
    const numberBet = interaction.options.getInteger('number');

    // Validate number bet
    if (betType === 'number' && numberBet === null) {
      await interaction.reply({
        content: 'You must specify a number (0-36) when betting on a specific number.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Check cooldown
    const hasCooldown = await checkCooldown(guildId, userId, 'roulette');
    if (!hasCooldown) {
      await interaction.reply({
        content: 'You are on cooldown for roulette.',
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
    const spinningContainer = buildRouletteContainer('🎡 SPINNING...', betAmount, betType, numberBet);
    const message = await interaction.editReply(v2Payload([spinningContainer]));

    // Animate spin
    const wheelEmojis = ['🔴', '⚫', '🟢'];
    for (let i = 0; i < 3; i++) {
      await sleep(300);
      const animContainer = moduleContainer('casino');
      addText(animContainer, `### 🎡 Roulette Wheel Spinning ${wheelEmojis[i % 3]}\nBet: ${betAmount} on ${betType}`);
      addFooter(animContainer, 'Spinning...');
      await message.edit(v2Payload([animContainer]));
    }

    // Determine result
    const result = getRandomNumber(0, 36);

    // Check win
    const { won, multiplier } = checkRouletteWin(result, betType, numberBet);

    let winAmount = 0;
    let gameResult: 'win' | 'loss' = 'loss';

    if (won) {
      gameResult = 'win';
      winAmount = Math.floor(betAmount * multiplier);
      await awardWinnings(guildId, userId, winAmount);
    }

    const isRed = redNumbers.includes(result);
    const resultColor = result === 0 ? '🟢' : isRed ? '🔴' : '⚫';

    const finalContainer = won
      ? successContainer(`Roulette Result: ${resultColor} ${result}`,
          `Bet: ${betAmount} on ${betType}${numberBet !== null ? ` (${numberBet})` : ''}\nResult: ✅ WIN ${multiplier}x\nWin Amount: ${winAmount}`)
      : errorContainer(`Roulette Result: ${resultColor} ${result}`,
          `Bet: ${betAmount} on ${betType}${numberBet !== null ? ` (${numberBet})` : ''}\nResult: ❌ LOSE\nWin Amount: ${winAmount}`);

    addFooter(finalContainer, 'Roulette Game');

    await message.edit(v2Payload([finalContainer]));

    await logCasinoGame(
      guildId,
      userId,
      'roulette',
      betAmount,
      winAmount,
      multiplier,
      gameResult,
      { betType, numberBet, result }
    );

    // Set cooldown
    await setCooldown(guildId, userId, 'roulette', config.cooldown);
  },
};

function checkRouletteWin(
  result: number,
  betType: BetType,
  numberBet: number | null
): { won: boolean; multiplier: number } {
  const isRed = redNumbers.includes(result);
  const isBlack = result !== 0 && !isRed;

  switch (betType) {
    case 'red':
      return { won: isRed, multiplier: 2 };
    case 'black':
      return { won: isBlack, multiplier: 2 };
    case 'odd':
      return { won: result % 2 === 1, multiplier: 2 };
    case 'even':
      return { won: result % 2 === 0 && result !== 0, multiplier: 2 };
    case 'high':
      return { won: result >= 19 && result <= 36, multiplier: 2 };
    case 'low':
      return { won: result >= 1 && result <= 18, multiplier: 2 };
    case 'number':
      return { won: result === numberBet, multiplier: 36 };
    default:
      return { won: false, multiplier: 0 };
  }
}

function buildRouletteContainer(
  title: string,
  betAmount: number,
  betType: string,
  numberBet: number | null
) {
  const container = moduleContainer('casino');
  addText(container, `### ${title}\nBet: ${betAmount} on ${betType}${numberBet !== null ? ` (${numberBet})` : ''}`);
  addFooter(container, 'Roulette Game');

  return container;
}

export default command;
