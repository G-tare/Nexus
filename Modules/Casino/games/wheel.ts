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
  addFields,
  addSeparator,
  addFooter,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';

interface WheelSegment {
  multiplier: number;
  emoji: string;
  weight: number;
}

const wheelSegments: WheelSegment[] = [
  { multiplier: 0, emoji: '❌', weight: 25 },
  { multiplier: 0.5, emoji: '😢', weight: 20 },
  { multiplier: 1, emoji: '😐', weight: 20 },
  { multiplier: 1.5, emoji: '😊', weight: 15 },
  { multiplier: 2, emoji: '😄', weight: 10 },
  { multiplier: 3, emoji: '🎉', weight: 5 },
  { multiplier: 5, emoji: '🎊', weight: 3 },
  { multiplier: 10, emoji: '🏆', weight: 2 },
];

const command: BotCommand = {
  module: 'casino',
  permissionPath: 'casino.wheel',
  data: new SlashCommandBuilder()
    .setName('wheel')
    .setDescription('Spin the wheel of fortune!')
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
    const hasCooldown = await checkCooldown(guildId, userId, 'wheel');
    if (!hasCooldown) {
      await interaction.reply({
        content: 'You are on cooldown for wheel.',
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

    // Initial spinning container
    const spinningContainer = buildWheelContainer(
      '⬆️',
      'SPINNING THE WHEEL...',
      betAmount
    );

    const message = await interaction.editReply(v2Payload([spinningContainer]));

    // Animate wheel spin
    const arrows = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];
    for (let i = 0; i < 12; i++) {
      await sleep(100);
      const animContainer = buildWheelContainer(
        arrows[i % 8],
        'SPINNING THE WHEEL...',
        betAmount
      );
      await message.edit(v2Payload([animContainer]));
    }

    // Determine result using weighted randomization
    const result = selectWheelResult();
    const multiplier = result.multiplier;
    let winAmount = 0;
    let gameResult: 'win' | 'loss' = multiplier > 0 ? 'win' : 'loss';

    if (gameResult === 'win') {
      winAmount = Math.floor(betAmount * multiplier);
      await awardWinnings(guildId, userId, winAmount);
    }

    const celebrationEmojis = multiplier >= 5 ? ' 🎉🎊✨' : '';
    const finalContainer = gameResult === 'win'
      ? successContainer(`Wheel Result: ${result.emoji} ${multiplier}x${celebrationEmojis}`,
          `Bet: ${betAmount}\n✅ YOU WIN ${winAmount}!`)
      : errorContainer(`Wheel Result: ${result.emoji} ${multiplier}x${celebrationEmojis}`,
          `Bet: ${betAmount}\n❌ Better luck next time!`);

    addSeparator(finalContainer, 'small');
    addFields(finalContainer, [{ name: 'Multiplier', value: `${multiplier}x`, inline: true }]);
    addFooter(finalContainer, 'Wheel of Fortune');

    await message.edit(v2Payload([finalContainer]));

    await logCasinoGame(
      guildId,
      userId,
      'wheel',
      betAmount,
      winAmount,
      multiplier,
      gameResult,
      { result: result.emoji }
    );

    // Set cooldown
    await setCooldown(guildId, userId, 'wheel', config.cooldown);
  },
};

function buildWheelContainer(
  arrow: string,
  status: string,
  betAmount: number
) {
  const wheel = `
0x     0.5x     1x
❌      😢      😐

${arrow}

⬅️      🏆      ➡️

10x      3x      5x
5x      2x     1.5x
😄     🎉     🎊
  `;

  const container = moduleContainer('casino');
  addText(container, `### 🎡 Wheel of Fortune`);
  addSeparator(container, 'small');
  addText(container, `\`\`\`\n${wheel}\n\`\`\`\n${status}`);
  addFields(container, [{ name: 'Bet', value: `${betAmount}`, inline: true }]);
  addFooter(container, 'Spinning...');

  return container;
}

function selectWheelResult(): WheelSegment {
  const totalWeight = wheelSegments.reduce((sum, seg) => sum + seg.weight, 0);
  let random = Math.random() * totalWeight;

  for (const segment of wheelSegments) {
    random -= segment.weight;
    if (random <= 0) {
      return segment;
    }
  }

  return wheelSegments[0];
}

export default command;
