import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types';
import {
  checkCooldown,
  setCooldown,
  placeBet,
  awardWinnings,
  emitGameWon,
  emitGameLost,
  getFunConfig,
} from '../../helpers';


const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

interface Card {
  suit: string;
  rank: string;
}

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
}

function cardValue(card: Card): number {
  if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J') {
    return 10;
  }
  if (card.rank === 'A') {
    return 11;
  }
  return parseInt(card.rank);
}

function handValue(cards: Card[]): number {
  let value = 0;
  let aces = 0;

  for (const card of cards) {
    const val = cardValue(card);
    if (card.rank === 'A') {
      aces += 1;
    }
    value += val;
  }

  while (value > 21 && aces > 0) {
    value -= 10;
    aces -= 1;
  }

  return value;
}

function cardString(card: Card): string {
  return `${card.rank}${card.suit}`;
}

interface GameState {
  deck: Card[];
  playerHand: Card[];
  dealerHand: Card[];
  dealerShown: boolean;
  bet: number;
  gameOver: boolean;
  result: string;
}

export default {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Play Blackjack!')
    .addIntegerOption((option) =>
      option
        .setName('bet')
        .setDescription('Amount to bet (minimum 10)')
        .setRequired(true)
        .setMinValue(10)
    ),

  module: 'fun',
  permissionPath: 'fun.games.blackjack',
  premiumFeature: 'fun.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'blackjack');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before playing again!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const bet = interaction.options.getInteger('bet', true);
    const config = await getFunConfig(interaction.guildId!);

    const betResult = await placeBet(interaction.guildId!, interaction.user.id, bet, config);
    if (!betResult.success) {
      return interaction.reply({
        content: '❌ Insufficient currency to place this bet!',
        flags: MessageFlags.Ephemeral,
      });
    }

    const deck = createDeck();
    const playerHand = [deck.pop()!, deck.pop()!];
    const dealerHand = [deck.pop()!, deck.pop()!];

    const gameState: GameState = {
      deck,
      playerHand,
      dealerHand,
      dealerShown: false,
      bet,
      gameOver: false,
      result: '',
    };

    function getDisplay(): string {
      let display = `**Your Hand:**\n`;
      display += playerHand.map(cardString).join(' ');
      display += ` (${handValue(playerHand)})`;

      display += `\n\n**Dealer's Hand:**\n`;
      if (gameState.dealerShown) {
        display += dealerHand.map(cardString).join(' ');
        display += ` (${handValue(dealerHand)})`;
      } else {
        display += `${cardString(dealerHand[0])} 🂠`;
      }

      return display;
    }

    async function checkBlackjack(): Promise<boolean> {
      const playerValue = handValue(playerHand);
      const dealerValue = handValue(dealerHand);

      if (playerValue === 21 && playerHand.length === 2) {
        if (dealerValue === 21 && dealerHand.length === 2) {
          // Push
          gameState.result = "🤝 Push! Bet returned.";
          gameState.gameOver = true;
          return true;
        } else {
          // Player blackjack wins
          const winningsResult = await awardWinnings(interaction.guildId!, interaction.user.id, bet);
          const winnings = winningsResult.success ? bet * 2.5 : 0;
          emitGameWon(interaction.guildId!, interaction.user.id, 'blackjack', bet, winnings);
          gameState.result = `✅ Blackjack! You won **${winnings.toFixed(0)}**!`;
          gameState.gameOver = true;
          return true;
        }
      }

      return false;
    }

    async function endGame(): Promise<void> {
      gameState.dealerShown = true;
      const playerValue = handValue(playerHand);
      const dealerValue = handValue(dealerHand);

      if (playerValue > 21) {
        emitGameLost(interaction.guildId!, interaction.user.id, 'blackjack', bet);
        gameState.result = `❌ Bust! You went over 21.`;
      } else if (dealerValue > 21) {
        const winnings = bet * 2;
        awardWinnings(interaction.guildId!, interaction.user.id, winnings);
        emitGameWon(interaction.guildId!, interaction.user.id, 'blackjack', bet, winnings);
        gameState.result = `✅ Dealer bust! You won **${winnings}**!`;
      } else if (playerValue > dealerValue) {
        const winnings = bet * 2;
        awardWinnings(interaction.guildId!, interaction.user.id, winnings);
        emitGameWon(interaction.guildId!, interaction.user.id, 'blackjack', bet, winnings);
        gameState.result = `✅ You won **${winnings}**!`;
      } else if (playerValue < dealerValue) {
        emitGameLost(interaction.guildId!, interaction.user.id, 'blackjack', bet);
        gameState.result = `❌ Dealer won!`;
      } else {
        gameState.result = `🤝 Push! Bet returned.`;
      }

      gameState.gameOver = true;
    }

    if (await checkBlackjack()) {
      const embed = new EmbedBuilder()
        .setTitle('🎰 Blackjack')
        .setDescription(getDisplay())
        .addFields({
          name: 'Result',
          value: gameState.result,
          inline: false,
        });

      if (gameState.result.includes('won')) {
        embed.setColor(0x00ff00);
      } else {
        embed.setColor(0xffff00);
      }

      await interaction.reply({ embeds: [embed] });
      await setCooldown(interaction.guildId!, interaction.user.id, 'blackjack', 5);
      return;
    }

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('blackjack_hit')
        .setLabel('Hit')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('blackjack_stand')
        .setLabel('Stand')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('blackjack_double')
        .setLabel('Double Down')
        .setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
      .setTitle('🎰 Blackjack')
      .setDescription(getDisplay());

    const message = await interaction.reply({
      embeds: [embed],
      components: [buttons],
      fetchReply: true,
    });

    const collector = message.createMessageComponentCollector({
      time: 60000,
    });

    let playerDone = false;

    collector.on('collect', async (buttonInteraction: ButtonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        return buttonInteraction.reply({
          content: '❌ This is not your game!',
          flags: MessageFlags.Ephemeral,
        });
      }

      if (gameState.gameOver) {
        return buttonInteraction.reply({
          content: '❌ Game already over!',
          flags: MessageFlags.Ephemeral,
        });
      }

      if (buttonInteraction.customId === 'blackjack_hit') {
        playerHand.push(gameState.deck.pop()!);

        if (handValue(playerHand) > 21) {
          await endGame();
          playerDone = true;
        }

        const newEmbed = new EmbedBuilder()
          .setTitle('🎰 Blackjack')
          .setDescription(getDisplay());

        if (gameState.gameOver) {
          newEmbed.addFields({
            name: 'Result',
            value: gameState.result,
            inline: false,
          });

          if (gameState.result.includes('won')) {
            newEmbed.setColor(0x00ff00);
          } else {
            newEmbed.setColor(0xff0000);
          }

          await buttonInteraction.update({
            embeds: [newEmbed],
            components: [],
          });
          collector.stop();
        } else {
          await buttonInteraction.update({
            embeds: [newEmbed],
          });
        }
      } else if (buttonInteraction.customId === 'blackjack_stand') {
        playerDone = true;

        // Dealer AI: hit on 16 or less, stand on 17+
        while (handValue(dealerHand) < 17) {
          dealerHand.push(gameState.deck.pop()!);
        }

        await endGame();

        const newEmbed = new EmbedBuilder()
          .setTitle('🎰 Blackjack')
          .setDescription(getDisplay())
          .addFields({
            name: 'Result',
            value: gameState.result,
            inline: false,
          });

        if (gameState.result.includes('won')) {
          newEmbed.setColor(0x00ff00);
        } else if (gameState.result.includes('Push')) {
          newEmbed.setColor(0xffff00);
        } else {
          newEmbed.setColor(0xff0000);
        }

        await buttonInteraction.update({
          embeds: [newEmbed],
          components: [],
        });
        collector.stop();
      } else if (buttonInteraction.customId === 'blackjack_double') {
        // Double bet and add one card
        playerHand.push(gameState.deck.pop()!);

        if (handValue(playerHand) > 21) {
          await endGame();
        } else {
          while (handValue(dealerHand) < 17) {
            dealerHand.push(gameState.deck.pop()!);
          }
          await endGame();
        }

        const newEmbed = new EmbedBuilder()
          .setTitle('🎰 Blackjack (Doubled Down)')
          .setDescription(getDisplay())
          .addFields({
            name: 'Result',
            value: gameState.result,
            inline: false,
          });

        if (gameState.result.includes('won')) {
          newEmbed.setColor(0x00ff00);
        } else if (gameState.result.includes('Push')) {
          newEmbed.setColor(0xffff00);
        } else {
          newEmbed.setColor(0xff0000);
        }

        await buttonInteraction.update({
          embeds: [newEmbed],
          components: [],
        });
        collector.stop();
      }
    });

    collector.on('end', async (collected) => {
      if (!gameState.gameOver) {
        gameState.result = '⏱️ Time\'s up! You stand with your current hand.';

        while (handValue(dealerHand) < 17) {
          dealerHand.push(gameState.deck.pop()!);
        }

        await endGame();

        const timeoutEmbed = new EmbedBuilder()
          .setTitle('🎰 Blackjack')
          .setDescription(getDisplay())
          .addFields({
            name: 'Result',
            value: gameState.result,
            inline: false,
          });

        if (gameState.result.includes('won')) {
          timeoutEmbed.setColor(0x00ff00);
        } else if (gameState.result.includes('Push')) {
          timeoutEmbed.setColor(0xffff00);
        } else {
          timeoutEmbed.setColor(0xff0000);
        }

        await message.edit({
          embeds: [timeoutEmbed],
          components: [],
        });
      }
    });

    await setCooldown(interaction.guildId!, interaction.user.id, 'blackjack', 5);
  },
  category: 'fun',
} as BotCommand;
