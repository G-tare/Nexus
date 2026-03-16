import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getChildren, disown, getFamilyConfig } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { errorContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('Family');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('disown')
    .setDescription('Disown a child')
    .addUserOption((opt) => opt.setName('user').setDescription('Child to disown').setRequired(true)),

  module: 'family',
  permissionPath: 'family.disown',

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

    const targetUser = interaction.options.getUser('user', true);

    if (targetUser.id === interaction.user.id) {
      await interaction.reply({
        content: '❌ You cannot disown yourself.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const children = await getChildren(interaction.guildId!, interaction.user.id);

    if (!children.includes(targetUser.id)) {
      await interaction.reply({
        content: '❌ This user is not your child.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`family_disown_confirm_${interaction.id}`)
        .setLabel('Confirm Disown')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`family_disown_cancel_${interaction.id}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );

    const response = await interaction.reply({
      content: `⚠️ Are you sure you want to disown <@${targetUser.id}>? This cannot be undone.`,
      components: [confirmRow],
      flags: MessageFlags.Ephemeral,
    });

    try {
      const buttonInteraction = await response.awaitMessageComponent({
        time: 60000,
        filter: (i) => i.user.id === interaction.user.id,
      });

      if (buttonInteraction.customId === `family_disown_confirm_${interaction.id}`) {
        await disown(interaction.guildId!, interaction.user.id, targetUser.id);

        const container = errorContainer('👶 Disowned', `You have disowned <@${targetUser.id}>.`);

        await buttonInteraction.update({
          ...v2Payload([container]),
        });
      } else {
        await buttonInteraction.update({
          content: '❌ Disown cancelled.',
          components: [],
        });
      }
    } catch (error) {
      await response.edit({
        content: '⚠️ Button interaction timed out. Disown was not processed.',
        components: [],
      });
    }
  },
};

export default command;
