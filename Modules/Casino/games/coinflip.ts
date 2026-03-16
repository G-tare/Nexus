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

const command: BotCommand = {
  module: 'casino',
  permissionPath: 'casino.coinflip',
  data: new SlashCommandBuilder()
    .setName('casino-coinflip')
    .setDescription('Flip a coin - heads or tails?')
    .addIntegerOption((opt) =>
      opt
        .setName('bet')
        .setDescription('Amount to bet')
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption((opt) =>
      opt
        .setName('choice')
        .setDescription('Choose heads or tails')
        .setRequired(true)
        .addChoices(
          { name: 'Heads', value: 'heads' },
          { name: 'Tails', value: 'tails' }
        )
    ),

  execute: async (interaction: ChatInputCommandInteraction) => {

    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const betAmount = interaction.options.getInteger('bet')!;
    const choice = interaction.options.getString('choice') as 'heads' | 'tails';

    // Check cooldown
    const hasCooldown = await checkCooldown(guildId, userId, 'coinflip');
    if (!hasCooldown) {
      await interaction.reply({
        content: 'You are on cooldown for coin flip.',
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
    const spinningContainer = moduleContainer('casino');
    addText(spinningContainer, `### 🪙 Flipping Coin...\nYou chose: **${choice}**\nBet: ${betAmount}`);
    addFooter(spinningContainer, 'Coin Flip Game');

    const message = await interaction.editReply(v2Payload([spinningContainer]));

    // Animate flip
    const coins = ['🪙', '🟡'];
    for (let i = 0; i < 4; i++) {
      await sleep(200);
      const animContainer = moduleContainer('casino');
      addText(animContainer, `### ${coins[i % 2]} Flipping...\nYou chose: **${choice}**\nBet: ${betAmount}`);
      addFooter(animContainer, 'Spinning...');
      await message.edit(v2Payload([animContainer]));
    }

    // Determine result
    const result = getRandomNumber(0, 1) === 0 ? 'heads' : 'tails';
    const won = result === choice;
    const multiplier = 1.95; // 2% house edge
    let winAmount = 0;
    let gameResult: 'win' | 'loss' = 'loss';

    if (won) {
      gameResult = 'win';
      winAmount = Math.floor(betAmount * multiplier);
      await awardWinnings(guildId, userId, winAmount);
    }

    const resultEmoji = result === 'heads' ? '👑' : '⚓';

    const finalContainer = won
      ? successContainer(`Coin Flip: ${resultEmoji} ${result.toUpperCase()}!`,
          `You chose: **${choice}**\nResult: **${result}**\n✅ YOU WIN! (${(multiplier * 100 - 100).toFixed(0)}% return)\nWin Amount: ${winAmount}`)
      : errorContainer(`Coin Flip: ${resultEmoji} ${result.toUpperCase()}!`,
          `You chose: **${choice}**\nResult: **${result}**\n❌ YOU LOSE\nWin Amount: ${winAmount}`);

    addFooter(finalContainer, 'Coin Flip Game');

    await message.edit(v2Payload([finalContainer]));

    await logCasinoGame(
      guildId,
      userId,
      'coinflip',
      betAmount,
      winAmount,
      multiplier,
      gameResult,
      { choice, result }
    );

    // Set cooldown
    await setCooldown(guildId, userId, 'coinflip', config.cooldown);
  },
};

export default command;
