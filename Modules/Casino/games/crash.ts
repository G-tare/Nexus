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
  exponentialDistribution,
  sleep,
} from '../helpers';
import {
  moduleContainer,
  successContainer,
  errorContainer,
  addText,
  addButtons,
  addFooter,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  module: 'casino',
  permissionPath: 'casino.crash',
  data: new SlashCommandBuilder()
    .setName('crash')
    .setDescription('Play the crash game - cash out before it crashes!')
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
    const hasCooldown = await checkCooldown(guildId, userId, 'crash');
    if (!hasCooldown) {
      await interaction.reply({
        content: 'You are on cooldown for crash.',
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

    // Determine crash point
    const crashPoint = exponentialDistribution(20);

    // Game state
    let multiplier = 1.0;
    let crashed = false;
    let cashedOut = false;
    let cashOutMultiplier = 0;
    let startTime = Date.now();

    const initialContainer = buildCrashContainer(multiplier, betAmount, 'Going up...');
    const cashoutBtn = new ButtonBuilder()
      .setCustomId('cashout')
      .setLabel('Cash Out')
      .setStyle(ButtonStyle.Success);
    addButtons(initialContainer, [cashoutBtn]);

    const message = await interaction.editReply(v2Payload([initialContainer]));

    // Collect button interactions
    const collector = message.createMessageComponentCollector({
      time: 30000,
    });

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.user.id !== userId) {
        await buttonInteraction.reply({
          content: 'This is not your game.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (buttonInteraction.customId === 'cashout' && !cashedOut && !crashed) {
        cashedOut = true;
        cashOutMultiplier = parseFloat(multiplier.toFixed(2));

        const winAmount = Math.floor(betAmount * cashOutMultiplier);
        await awardWinnings(guildId, userId, winAmount);

        const finalContainer = successContainer('Crash',
          `Current Multiplier: **${cashOutMultiplier.toFixed(2)}x**\n\nBet: ${betAmount}\n💰 CASHED OUT at ${cashOutMultiplier.toFixed(2)}x! Won ${winAmount}`
        );
        addFooter(finalContainer, 'Crash Game');

        await buttonInteraction.update(v2Payload([finalContainer]));

        await logCasinoGame(
          guildId,
          userId,
          'crash',
          betAmount,
          winAmount,
          cashOutMultiplier,
          'win',
          { crashPoint, cashedOut: true }
        );

        collector.stop();
      }
    });

    // Game loop
    const gameLoop = setInterval(async () => {
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      multiplier = 1 + elapsedSeconds * 0.5;

      if (multiplier >= crashPoint) {
        crashed = true;
        clearInterval(gameLoop);

        const crashContainer = errorContainer('Crash',
          `Current Multiplier: **${crashPoint.toFixed(2)}x**\n\nBet: ${betAmount}\n💥 CRASHED at ${crashPoint.toFixed(2)}x! You lost ${betAmount}`
        );
        addFooter(crashContainer, 'Crash Game');

        try {
          await message.edit(v2Payload([crashContainer]));
        } catch {
          // Message already deleted
        }

        await logCasinoGame(
          guildId,
          userId,
          'crash',
          betAmount,
          0,
          0,
          'loss',
          { crashPoint, cashedOut: false }
        );

        collector.stop();
      } else if (!cashedOut && !crashed) {
        try {
          const currentContainer = buildCrashContainer(
            multiplier,
            betAmount,
            'Going up...'
          );

          await message.edit(v2Payload([currentContainer]));
        } catch {
          // Message might be deleted
          clearInterval(gameLoop);
          collector.stop();
        }
      }
    }, 1000);

    collector.on('end', () => {
      clearInterval(gameLoop);
    });

    // Set cooldown
    await setCooldown(guildId, userId, 'crash', config.cooldown);
  },
};

function buildCrashContainer(
  multiplier: number,
  betAmount: number,
  status: string
) {
  const container = moduleContainer('casino');
  addText(container, `### 📈 Crash\nCurrent Multiplier: **${multiplier.toFixed(2)}x**\n\nBet: ${betAmount}\n${status}`);
  addFooter(container, 'Crash Game');

  return container;
}

export default command;
