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
} from '../helpers';
import {
  moduleContainer,
  addText,
  addFields,
  addButtons,
  addSeparator,
  addFooter,
  v2Payload,
} from '../../../Shared/src/utils/componentsV2';

const command: BotCommand = {
  module: 'casino',
  permissionPath: 'casino.blackjack',
  data: new SlashCommandBuilder()
    .setName('casino-blackjack')
    .setDescription('Play blackjack against the dealer')
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
    const hasCooldown = await checkCooldown(guildId, userId, 'blackjack');
    if (!hasCooldown) {
      await interaction.reply({
        content: 'You are on cooldown for blackjack.',
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

    // Initialize game
    const deck = createDeck();
    const playerCards: Card[] = [];
    const dealerCards: Card[] = [];

    // Deal 2 to each
    playerCards.push(deck.pop()!);
    playerCards.push(deck.pop()!);
    dealerCards.push(deck.pop()!);
    dealerCards.push(deck.pop()!);

    await interaction.deferReply();

    // Initial container
    const initialContainer = buildInitialContainer(
      playerCards,
      dealerCards,
      betAmount
    );
    const hitButton = new ButtonBuilder()
      .setCustomId('hit')
      .setLabel('Hit')
      .setStyle(ButtonStyle.Primary);
    const standButton = new ButtonBuilder()
      .setCustomId('stand')
      .setLabel('Stand')
      .setStyle(ButtonStyle.Success);
    addButtons(initialContainer, [hitButton, standButton]);

    const message = await interaction.editReply(v2Payload([initialContainer]));

    // Collect button interactions
    let gameActive = true;
    let playerStand = false;
    let playerBust = false;
    let doubledDown = false;

    const collector = message.createMessageComponentCollector({
      time: 60000,
    });

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.user.id !== userId) {
        await buttonInteraction.reply({
          content: 'This is not your game.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const action = buttonInteraction.customId;

      if (action === 'hit') {
        playerCards.push(deck.pop()!);
        const playerValue = calculateHandValue(playerCards);

        if (playerValue > 21) {
          playerBust = true;
          gameActive = false;

          const finalContainer = buildGameContainer(
            playerCards,
            dealerCards,
            betAmount,
            'BUST - You went over 21!'
          );

          await buttonInteraction.update(v2Payload([finalContainer]));

          // Log game
          await logCasinoGame(
            guildId,
            userId,
            'blackjack',
            betAmount,
            0,
            0,
            'loss',
            { result: 'bust', playerValue }
          );
          collector.stop();
        } else {
          const newContainer = buildGameContainer(
            playerCards,
            dealerCards,
            betAmount,
            `Your hand: ${playerValue}`
          );

          const hitBtn = new ButtonBuilder()
            .setCustomId('hit')
            .setLabel('Hit')
            .setStyle(ButtonStyle.Primary);
          const doubleBtn = new ButtonBuilder()
            .setCustomId('double')
            .setLabel('Double Down')
            .setStyle(ButtonStyle.Secondary);
          const standBtn = new ButtonBuilder()
            .setCustomId('stand')
            .setLabel('Stand')
            .setStyle(ButtonStyle.Success);

          addButtons(newContainer, [hitBtn, doubleBtn, standBtn]);

          await buttonInteraction.update(v2Payload([newContainer]));
        }
      } else if (action === 'stand') {
        playerStand = true;

        // Dealer plays
        let dealerValue = calculateHandValue(dealerCards);
        while (dealerValue < 17) {
          dealerCards.push(deck.pop()!);
          dealerValue = calculateHandValue(dealerCards);
        }

        const playerValue = calculateHandValue(playerCards);
        let result: 'win' | 'loss' | 'push';
        let winAmount = 0;
        let multiplier = 0;

        if (dealerValue > 21) {
          result = 'win';
          winAmount = betAmount * 2;
          multiplier = 2;
        } else if (playerValue > dealerValue) {
          result = 'win';
          winAmount = betAmount * 2;
          multiplier = 2;
        } else if (playerValue === dealerValue) {
          result = 'push';
          winAmount = betAmount;
          multiplier = 1;
        } else {
          result = 'loss';
          winAmount = 0;
          multiplier = 0;
        }

        if (result !== 'loss') {
          await awardWinnings(guildId, userId, winAmount);
        }

        const finalContainer = buildGameContainer(
          playerCards,
          dealerCards,
          betAmount,
          `Dealer: ${dealerValue} | You: ${playerValue} | ${
            result === 'win' ? 'YOU WIN!' : result === 'push' ? 'PUSH' : 'YOU LOSE'
          }`
        );

        await buttonInteraction.update(v2Payload([finalContainer]));

        await logCasinoGame(
          guildId,
          userId,
          'blackjack',
          betAmount,
          winAmount,
          multiplier,
          result,
          { playerValue, dealerValue, playerBust }
        );

        collector.stop();
      } else if (action === 'double') {
        doubledDown = true;
        const newBet = betAmount * 2;

        // Deduct extra bet
        const extraBetResult = await placeBet(
          guildId,
          userId,
          betAmount,
          config
        );
        if (!extraBetResult.success) {
          await buttonInteraction.reply({
            content: 'Insufficient funds to double down.',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        playerCards.push(deck.pop()!);
        const playerValue = calculateHandValue(playerCards);

        if (playerValue > 21) {
          playerBust = true;
          gameActive = false;

          const finalContainer = buildGameContainer(
            playerCards,
            dealerCards,
            newBet,
            'BUST - You went over 21!'
          );

          await buttonInteraction.update(v2Payload([finalContainer]));

          await logCasinoGame(
            guildId,
            userId,
            'blackjack',
            newBet,
            0,
            0,
            'loss',
            { result: 'bust_double', playerValue }
          );
          collector.stop();
        } else {
          // Auto-stand after double
          let dealerValue = calculateHandValue(dealerCards);
          while (dealerValue < 17) {
            dealerCards.push(deck.pop()!);
            dealerValue = calculateHandValue(dealerCards);
          }

          let result: 'win' | 'loss' | 'push';
          let winAmount = 0;
          let multiplier = 0;

          if (dealerValue > 21) {
            result = 'win';
            winAmount = newBet * 2;
            multiplier = 2;
          } else if (playerValue > dealerValue) {
            result = 'win';
            winAmount = newBet * 2;
            multiplier = 2;
          } else if (playerValue === dealerValue) {
            result = 'push';
            winAmount = newBet;
            multiplier = 1;
          } else {
            result = 'loss';
            winAmount = 0;
            multiplier = 0;
          }

          if (result !== 'loss') {
            await awardWinnings(guildId, userId, winAmount);
          }

          const finalContainer = buildGameContainer(
            playerCards,
            dealerCards,
            newBet,
            `Dealer: ${dealerValue} | You: ${playerValue} | ${
              result === 'win' ? 'YOU WIN!' : result === 'push' ? 'PUSH' : 'YOU LOSE'
            }`
          );

          await buttonInteraction.update(v2Payload([finalContainer]));

          await logCasinoGame(
            guildId,
            userId,
            'blackjack',
            newBet,
            winAmount,
            multiplier,
            result,
            { playerValue, dealerValue, doubled: true }
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
    await setCooldown(guildId, userId, 'blackjack', config.cooldown);
  },
};

function buildInitialContainer(
  playerCards: Card[],
  dealerCards: Card[],
  betAmount: number
) {
  const playerEmoji = playerCards.map((c) => getCardEmoji(c)).join(' ');
  const dealerEmoji = `${getCardEmoji(dealerCards[0])} 🃏`;
  const playerValue = calculateHandValue(playerCards);

  const container = moduleContainer('casino');
  addText(container, `### 🃏 Blackjack`);
  addSeparator(container, 'small');
  addText(container, `**Dealer's Hand:**\n${dealerEmoji}\n\n**Your Hand:**\n${playerEmoji}\nValue: ${playerValue}`);
  addFields(container, [
    { name: 'Bet', value: `${betAmount}`, inline: true },
    { name: 'Status', value: 'Choose your action', inline: true }
  ]);
  addFooter(container, 'Blackjack Game');

  return container;
}

function buildGameContainer(
  playerCards: Card[],
  dealerCards: Card[],
  betAmount: number,
  status: string
) {
  const playerEmoji = playerCards.map((c) => getCardEmoji(c)).join(' ');
  const dealerEmoji = dealerCards.map((c) => getCardEmoji(c)).join(' ');
  const playerValue = calculateHandValue(playerCards);
  const dealerValue = calculateHandValue(dealerCards);

  const container = moduleContainer('casino');
  addText(container, `### 🃏 Blackjack`);
  addSeparator(container, 'small');
  addText(container, `**Dealer's Hand:**\n${dealerEmoji}\nValue: ${dealerValue}\n\n**Your Hand:**\n${playerEmoji}\nValue: ${playerValue}`);
  addFields(container, [
    { name: 'Bet', value: `${betAmount}`, inline: true },
    { name: 'Status', value: status, inline: true }
  ]);
  addFooter(container, 'Blackjack Game');

  return container;
}

export default command;
