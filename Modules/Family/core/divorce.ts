import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getPartner, divorce, getFamilyConfig } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { errorContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('Family');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('divorce')
    .setDescription('Divorce your partner'),

  module: 'family',
  permissionPath: 'family.divorce',

  execute: async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guild) {
      await interaction.reply({
        content: '❌ This command only works in servers.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const config = await getFamilyConfig(interaction.guildId!);

    if (!config.enabled) {
      await interaction.reply({
        content: '❌ Family module is disabled on this server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const partner = await getPartner(interaction.guildId!, interaction.user.id);

    if (!partner) {
      await interaction.reply({
        content: '❌ You are not married.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`family_divorce_confirm_${interaction.id}`)
        .setLabel('Confirm Divorce')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`family_divorce_cancel_${interaction.id}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

    const response = await interaction.reply({
      content: `⚠️ Are you sure you want to divorce <@${partner}>? This cannot be undone.`,
      components: [confirmRow],
      flags: MessageFlags.Ephemeral,
    });

    try {
      const buttonInteraction = await response.awaitMessageComponent({
        time: 60000,
        filter: (i) => i.user.id === interaction.user.id,
      });

      if (buttonInteraction.customId === `family_divorce_confirm_${interaction.id}`) {
        await divorce(interaction.guildId!, interaction.user.id);

        const container = errorContainer('💔 Divorce Complete', `You have divorced <@${partner}>.`);

        await buttonInteraction.update({
          ...v2Payload([container]),
        });
      } else {
        await buttonInteraction.update({
          content: '❌ Divorce cancelled.',
          components: [],
        });
      }
    } catch (error) {
      await response.edit({
        content: '⚠️ Button interaction timed out. Divorce was not processed.',
        components: [],
      });
    }
  },
};

export default command;
