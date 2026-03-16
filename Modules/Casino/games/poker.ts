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

interface Hand {
  cards: Card[];
  held: boolean[];
}

const command: BotCommand = {
  module: 'casino',
  permissionPath: 'casino.poker',
  data: new SlashCommandBuilder()
    .setName('poker')
    .setDescription('Play video poker')
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
    const hasCooldown = await checkCooldown(guildId, userId, 'poker');
    if (!hasCooldown) {
      await interaction.reply({
        content: 'You are on cooldown for poker.',
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

    // Deal initial hand
    const deck = createDeck();
    const hand: Hand = {
      cards: [deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!],
      held: [false, false, false, false, false],
    };

    const initialContainer = buildPokerContainer(
      hand,
      betAmount,
      'Select cards to hold, then draw'
    );

    const holdBtns = Array.from({ length: 5 }).map((_, i) =>
      new ButtonBuilder()
        .setCustomId(`hold_${i}`)
        .setLabel(`Hold Card ${i + 1}`)
        .setStyle(ButtonStyle.Secondary)
    );
    const drawBtn = new ButtonBuilder()
      .setCustomId('draw')
      .setLabel('Draw')
      .setStyle(ButtonStyle.Success);

    addButtons(initialContainer, [...holdBtns, drawBtn]);

    const message = await interaction.editReply(v2Payload([initialContainer]));

    // Collect button interactions
    const collector = message.createMessageComponentCollector({
      time: 60000,
    });

    let gamePhase = 'holding'; // 'holding' or 'finished'

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.user.id !== userId) {
        await buttonInteraction.reply({
          content: 'This is not your game.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const customId = buttonInteraction.customId;

      if (customId.startsWith('hold_')) {
        const cardIndex = parseInt(customId.split('_')[1], 10);
        hand.held[cardIndex] = !hand.held[cardIndex];

        const updatedContainer = buildPokerContainer(
          hand,
          betAmount,
          'Select cards to hold, then draw'
        );

        const newHoldBtns = Array.from({ length: 5 }).map((_, i) =>
          new ButtonBuilder()
            .setCustomId(`hold_${i}`)
            .setLabel(`${hand.held[i] ? '✅' : ''} Card ${i + 1}`)
            .setStyle(hand.held[i] ? ButtonStyle.Primary : ButtonStyle.Secondary)
        );
        const newDrawBtn = new ButtonBuilder()
          .setCustomId('draw')
          .setLabel('Draw')
          .setStyle(ButtonStyle.Success);

        addButtons(updatedContainer, [...newHoldBtns, newDrawBtn]);

        await buttonInteraction.update(v2Payload([updatedContainer]));
      } else if (customId === 'draw') {
        gamePhase = 'finished';

        // Replace non-held cards
        for (let i = 0; i < hand.cards.length; i++) {
          if (!hand.held[i]) {
            hand.cards[i] = deck.pop()!;
          }
        }

        // Evaluate hand
        const { handName, multiplier } = evaluatePokerHand(hand.cards);

        let winAmount = 0;
        let gameResult: 'win' | 'loss' = 'loss';

        if (multiplier > 0) {
          gameResult = 'win';
          winAmount = Math.floor(betAmount * multiplier);
          await awardWinnings(guildId, userId, winAmount);
        }

        const finalContainer = gameResult === 'win'
          ? successContainer('Poker Result', `**${handName}** (${multiplier}x)\n\nBet: ${betAmount}\nWin: ${winAmount}`)
          : errorContainer('Poker Result', `**${handName}** (${multiplier}x)\n\nBet: ${betAmount}\nWin: ${winAmount}`);

        addSeparator(finalContainer, 'small');
        addFields(finalContainer, [{
          name: 'Your Hand',
          value: hand.cards.map(getCardEmoji).join(' '),
          inline: false,
        }]);
        addFooter(finalContainer, 'Video Poker');

        await buttonInteraction.update(v2Payload([finalContainer]));

        await logCasinoGame(
          guildId,
          userId,
          'poker',
          betAmount,
          winAmount,
          multiplier,
          gameResult,
          { handName }
        );

        collector.stop();
      }
    });

    collector.on('end', async () => {
      if (gamePhase !== 'finished') {
        try {
          await message.edit({ components: [] });
        } catch {
          // Message already deleted
        }
      }
    });

    // Set cooldown
    await setCooldown(guildId, userId, 'poker', config.cooldown);
  },
};

function buildPokerContainer(
  hand: Hand,
  betAmount: number,
  status: string
) {
  const cardsDisplay = hand.cards
    .map((card, i) => `${hand.held[i] ? '✅' : '  '} ${getCardEmoji(card)}`)
    .join('\n');

  const container = moduleContainer('casino');
  addText(container, `### 🃏 Video Poker\n${cardsDisplay}\n\n${status}`);
  addFields(container, [{ name: 'Bet', value: `${betAmount}`, inline: true }]);
  addFooter(container, 'Video Poker Game');

  return container;
}

interface PokerResult {
  handName: string;
  multiplier: number;
}

function evaluatePokerHand(cards: Card[]): PokerResult {
  // Sort cards by value for easier evaluation
  const values = cards.map((c) => getCardValue(c)).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const cardStrings = cards.map((c) => c.value);

  // Check for flush
  const isFlush = suits.every((s) => s === suits[0]);

  // Check for straight
  const uniqueValues = Array.from(new Set(values)).sort((a, b) => b - a);
  let isStraight = false;
  if (uniqueValues.length === 5) {
    isStraight =
      uniqueValues[0] - uniqueValues[4] === 4 ||
      (cardStrings.includes('A') &&
        cardStrings.includes('K') &&
        cardStrings.includes('Q') &&
        cardStrings.includes('J') &&
        cardStrings.includes('10'));
  }

  // Check for royal flush
  if (
    isFlush &&
    isStraight &&
    cardStrings.includes('A') &&
    cardStrings.includes('K') &&
    cardStrings.includes('Q') &&
    cardStrings.includes('J') &&
    cardStrings.includes('10')
  ) {
    return { handName: 'Royal Flush', multiplier: 250 };
  }

  // Check for straight flush
  if (isFlush && isStraight) {
    return { handName: 'Straight Flush', multiplier: 50 };
  }

  // Check for kinds
  const valueCounts: { [key: number]: number } = {};
  for (const value of values) {
    valueCounts[value] = (valueCounts[value] || 0) + 1;
  }

  const counts = Object.values(valueCounts).sort((a, b) => b - a);

  if (counts[0] === 4) {
    return { handName: '4 of a Kind', multiplier: 25 };
  }

  if (counts[0] === 3 && counts[1] === 2) {
    return { handName: 'Full House', multiplier: 9 };
  }

  if (isFlush) {
    return { handName: 'Flush', multiplier: 6 };
  }

  if (isStraight) {
    return { handName: 'Straight', multiplier: 4 };
  }

  if (counts[0] === 3) {
    return { handName: '3 of a Kind', multiplier: 3 };
  }

  if (counts[0] === 2 && counts[1] === 2) {
    return { handName: 'Two Pair', multiplier: 2 };
  }

  // Check for Jacks or Better
  if (counts[0] === 2) {
    const pairValue = Object.keys(valueCounts).find(
      (k) => valueCounts[parseInt(k, 10)] === 2
    );
    if (pairValue && parseInt(pairValue, 10) >= 11) {
      // J, Q, K, A
      return { handName: 'Pair (Jacks+)', multiplier: 1 };
    }
  }

  return { handName: 'No Pair', multiplier: 0 };
}

function getCardValue(card: Card): number {
  if (card.value === 'A') return 14;
  if (card.value === 'K') return 13;
  if (card.value === 'Q') return 12;
  if (card.value === 'J') return 11;
  return parseInt(card.value, 10);
}

export default command;
