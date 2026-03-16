import {
  SlashCommandBuilder,
  MessageFlags,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { BotCommand } from '../../../../Shared/src/types/command';
import { checkCooldown, setCooldown } from '../../helpers';
import { moduleContainer, addText, addFields, v2Payload } from '../../../../Shared/src/utils/componentsV2';

const CARD_VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const CARD_SUITS = ['♠️', '♥️', '♦️', '♣️'];

const getRandomCard = () => {
  const value = CARD_VALUES[Math.floor(Math.random() * CARD_VALUES.length)];
  const suit = CARD_SUITS[Math.floor(Math.random() * CARD_SUITS.length)];
  return { value, suit };
};

const getCardValue = (card: { value: string; suit: string }) => {
  const index = CARD_VALUES.indexOf(card.value);
  return index;
};

export default {
  data: new SlashCommandBuilder()
    .setName('highlow')
    .setDescription('Predict if next card is higher or lower'),

  module: 'fun',
  permissionPath: 'fun.games.highlow',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'highlow');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before playing again!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    let currentCard = getRandomCard();
    let streak = 0;
    let gameOver = false;

    const buildContainer = () => {
      const container = moduleContainer('fun');
      addText(container, '### Higher or Lower');
      addText(container, `Current Card: **${currentCard.value}${currentCard.suit}**\n\nIs the next card higher or lower?`);
      addFields(container, [{ name: 'Streak', value: String(streak) }]);
      return container;
    };

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('higher')
          .setLabel('⬆️ Higher')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('lower')
          .setLabel('⬇️ Lower')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('end')
          .setLabel('Stop Playing')
          .setStyle(ButtonStyle.Danger)
      );

    const container = buildContainer();
    container.addActionRowComponents(row);
    const msg = await interaction.reply({ ...v2Payload([container]), fetchReply: true });

    const collector = msg.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({ content: 'Not your game!', flags: MessageFlags.Ephemeral });
        return;
      }

      if (buttonInteraction.customId === 'end') {
        gameOver = true;
        const endContainer = moduleContainer('fun');
        addText(endContainer, '### Game Ended');
        addText(endContainer, `Final Streak: **${streak}**`);
        await interaction.editReply(v2Payload([endContainer]));
        collector.stop();
        await buttonInteraction.deferUpdate();
        return;
      }

      const nextCard = getRandomCard();
      const currentValue = getCardValue(currentCard);
      const nextValue = getCardValue(nextCard);

      const isCorrect =
        (buttonInteraction.customId === 'higher' && nextValue > currentValue) ||
        (buttonInteraction.customId === 'lower' && nextValue < currentValue);

      if (isCorrect) {
        streak++;
        currentCard = nextCard;
        const correctContainer = buildContainer();
        addText(correctContainer, `That was: **${nextCard.value}${nextCard.suit}**\n\nCurrent Card: **${currentCard.value}${currentCard.suit}**\n\nIs the next card higher or lower?`);
        correctContainer.addActionRowComponents(row);
        await interaction.editReply(v2Payload([correctContainer]));
      } else {
        gameOver = true;
        const wrongContainer = moduleContainer('fun');
        addText(wrongContainer, '### ❌ Wrong!');
        addText(wrongContainer, `That was: **${nextCard.value}${nextCard.suit}**\n\nYour streak: **${streak}**`);
        await interaction.editReply(v2Payload([wrongContainer]));
        collector.stop();
      }

      await buttonInteraction.deferUpdate();
    });

    await setCooldown(interaction.guildId!, interaction.user.id, 'highlow', 3);
  },
} as BotCommand;
