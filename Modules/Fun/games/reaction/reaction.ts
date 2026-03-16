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
import { moduleContainer, addText, v2Payload } from '../../../../Shared/src/utils/componentsV2';

export default {
  data: new SlashCommandBuilder()
    .setName('reaction')
    .setDescription('Test your reaction speed'),

  module: 'fun',
  permissionPath: 'fun.games.reaction',
  premiumFeature: 'fun.basic',
  category: 'fun',

  async execute(interaction: ChatInputCommandInteraction) {
    const cooldown = await checkCooldown(interaction.guildId!, interaction.user.id, 'reaction');
    if (cooldown > 0) {
      return interaction.reply({
        content: `⏳ Wait ${cooldown}s before playing again!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const waitContainer = moduleContainer('fun');
    addText(waitContainer, '### Reaction Test');
    addText(waitContainer, '⏳ Wait for it...');

    await interaction.reply(v2Payload([waitContainer]));

    const delay = Math.random() * 4000 + 2000;
    await new Promise((resolve) => setTimeout(resolve, delay));

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('react_click')
          .setLabel('🟢 CLICK NOW!')
          .setStyle(ButtonStyle.Success)
      );

    const startTime = Date.now();
    const readyContainer = moduleContainer('fun');
    addText(readyContainer, '### Reaction Test');
    addText(readyContainer, '🟢 CLICK NOW!');
    readyContainer.addActionRowComponents(row);

    const msg = await interaction.editReply(v2Payload([readyContainer]));

    try {
      const buttonInteraction = await msg.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id,
        time: 5000,
      });

      const reactionTime = Date.now() - startTime;
      let rating = '';

      if (reactionTime < 200) {
        rating = 'Superhuman! 👽';
      } else if (reactionTime < 500) {
        rating = 'Great! 🔥';
      } else if (reactionTime < 1000) {
        rating = 'Average 👍';
      } else {
        rating = 'Slowpoke! 🐢';
      }

      const resultContainer = moduleContainer('fun');
      addText(resultContainer, '### Reaction Test Results');
      addText(resultContainer, `**${reactionTime}ms**\n${rating}`);

      await buttonInteraction.reply(v2Payload([resultContainer]));
    } catch (error) {
      const timeoutContainer = moduleContainer('fun');
      addText(timeoutContainer, '### Reaction Test');
      addText(timeoutContainer, 'Too slow! Time\'s up.');
      await interaction.editReply(v2Payload([timeoutContainer]));
    }

    await setCooldown(interaction.guildId!, interaction.user.id, 'reaction', 3);
  },
} as BotCommand;
