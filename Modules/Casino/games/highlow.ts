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
  createDeck,
  getCardEmoji,
  calculateHandValue,
  Card,
  sleep,
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

const command: BotCommand = {
  module: 'casino',
  permissionPath: 'casino.highlow',
  data: new SlashCommandBuilder()
    .setName('casino-highlow')
    .setDescription('Play High or Low card game')
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
    const initialBet = interaction.options.getInteger('bet')!;

    // Check cooldown
    const hasCooldown = await checkCooldown(guildId, userId, 'highlow');
    if (!hasCooldown) {
      await interaction.reply({
        content: 'You are on cooldown for high/low.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Get config
    const config = await getCasinoConfig(guildId);

    // Place initial bet
    const betResult = await placeBet(guildId, userId, initialBet, config);
    if (!betResult.success) {
      await interaction.reply({
        content: betResult.error || 'Failed to place bet',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();

    // Initialize game
    const deck = createDeck();
    let currentCard = deck.pop()!;
    let round = 0;
    let multiplier = 1.5;
    let gameActive = true;
    const roundMultipliers = [1.5, 2.25, 3.4, 5, 7.5, 11.25, 16.88, 25.31, 37.97, 56.96];

    const initialContainer = buildHighLowContainer(
      currentCard,
      null,
      round,
      initialBet,
      multiplier,
      'Choose Higher or Lower'
    );

    const higherBtn = new ButtonBuilder()
      .setCustomId('higher')
      .setLabel('Higher')
      .setStyle(ButtonStyle.Primary);
    const lowerBtn = new ButtonBuilder()
      .setCustomId('lower')
      .setLabel('Lower')
      .setStyle(ButtonStyle.Primary);
    const cashoutBtn = new ButtonBuilder()
      .setCustomId('cashout')
      .setLabel(`Cash Out (${multiplier.toFixed(2)}x)`)
      .setStyle(ButtonStyle.Success);

    addButtons(initialContainer, [higherBtn, lowerBtn, cashoutBtn]);

    const message = await interaction.editReply(v2Payload([initialContainer]));

    const collector = message.createMessageComponentCollector({
      time: 120000,
    });

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.user.id !== userId) {
        await buttonInteraction.reply({
          content: 'This is not your game.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (!gameActive) {
        await buttonInteraction.reply({
          content: 'Game has already ended.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const action = buttonInteraction.customId;

      if (action === 'cashout') {
        gameActive = false;
        const winAmount = Math.floor(initialBet * multiplier);
        await awardWinnings(guildId, userId, winAmount);

        const cashoutContainer = successContainer('Cashed Out!', `Initial Bet: ${initialBet}\nMultiplier: ${multiplier.toFixed(2)}x\nWin Amount: ${winAmount}`);
        addFooter(cashoutContainer, 'High/Low Game');

        await buttonInteraction.update(v2Payload([cashoutContainer]));

        await logCasinoGame(
          guildId,
          userId,
          'highlow',
          initialBet,
          winAmount,
          multiplier,
          'win',
          { rounds: round, cashedOut: true }
        );

        collector.stop();
      } else if (action === 'higher' || action === 'lower') {
        const choice = action === 'higher' ? 'higher' : 'lower';
        const nextCard = deck.pop()!;

        const currentValue = getHighLowValue(currentCard);
        const nextValue = getHighLowValue(nextCard);

        let won = false;
        if (choice === 'higher') {
          won = nextValue > currentValue;
        } else {
          won = nextValue < currentValue;
        }

        if (won) {
          round++;
          if (round >= roundMultipliers.length) {
            // Game over - max rounds reached
            gameActive = false;
            multiplier = roundMultipliers[roundMultipliers.length - 1];
            const winAmount = Math.floor(initialBet * multiplier);
            await awardWinnings(guildId, userId, winAmount);

            const finalContainer = successContainer('Max Rounds Reached!',
              `Current Card: ${getCardEmoji(nextCard)}\nYou guessed: ${choice}\n\nRounds: ${round}\nMultiplier: ${multiplier.toFixed(2)}x\nWin Amount: ${winAmount}`
            );
            addFooter(finalContainer, 'High/Low Game');

            await buttonInteraction.update(v2Payload([finalContainer]));

            await logCasinoGame(
              guildId,
              userId,
              'highlow',
              initialBet,
              winAmount,
              multiplier,
              'win',
              { rounds: round, maxRounds: true }
            );

            collector.stop();
          } else {
            multiplier = roundMultipliers[round];
            currentCard = nextCard;

            const continueContainer = buildHighLowContainer(
              currentCard,
              nextCard,
              round,
              initialBet,
              multiplier,
              `✅ Correct! Round ${round}`
            );

            const higherBtn2 = new ButtonBuilder()
              .setCustomId('higher')
              .setLabel('Higher')
              .setStyle(ButtonStyle.Primary);
            const lowerBtn2 = new ButtonBuilder()
              .setCustomId('lower')
              .setLabel('Lower')
              .setStyle(ButtonStyle.Primary);
            const cashoutBtn2 = new ButtonBuilder()
              .setCustomId('cashout')
              .setLabel(`Cash Out (${multiplier.toFixed(2)}x)`)
              .setStyle(ButtonStyle.Success);

            addButtons(continueContainer, [higherBtn2, lowerBtn2, cashoutBtn2]);

            await buttonInteraction.update(v2Payload([continueContainer]));
          }
        } else {
          // Wrong guess
          gameActive = false;

          const loseContainer = errorContainer('Wrong!',
            `Current Card: ${getCardEmoji(currentCard)}\nNext Card: ${getCardEmoji(nextCard)}\n` +
            `You guessed: ${choice}\n\nRounds Won: ${round}\nYou lost it all!`
          );
          addFooter(loseContainer, 'High/Low Game');

          await buttonInteraction.update(v2Payload([loseContainer]));

          await logCasinoGame(
            guildId,
            userId,
            'highlow',
            initialBet,
            0,
            0,
            'loss',
            { rounds: round, wrongGuess: true }
          );

          collector.stop();
        }
      }
    });

    collector.on('end', async () => {
      if (gameActive) {
        try {
          await message.edit({ components: [] });
        } catch {
          // Message already deleted
        }
      }
    });

    // Set cooldown
    await setCooldown(guildId, userId, 'highlow', config.cooldown);
  },
};

function buildHighLowContainer(
  currentCard: Card,
  previousCard: Card | null,
  round: number,
  bet: number,
  multiplier: number,
  status: string
) {
  let description = '';

  if (previousCard) {
    description += `Previous: ${getCardEmoji(previousCard)}\n`;
  }

  description += `Current: ${getCardEmoji(currentCard)}\n\n`;
  description += `Bet: ${bet}\nMultiplier: ${multiplier.toFixed(2)}x\nRound: ${round}/10\n\n`;
  description += status;

  const container = moduleContainer('casino');
  addText(container, `### 🃏 High or Low`);
  addSeparator(container, 'small');
  addText(container, description);
  addFooter(container, 'High/Low Card Game');

  return container;
}

function getHighLowValue(card: Card): number {
  if (card.value === 'A') return 14;
  if (card.value === 'K') return 13;
  if (card.value === 'Q') return 12;
  if (card.value === 'J') return 11;
  return parseInt(card.value, 10);
}

export default command;
