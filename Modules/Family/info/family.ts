import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getPartner, getParent, getChildren, getSiblings, getFamilyConfig } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, addFields, v2Payload } from '../../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('Family');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('family-info')
    .setDescription('View full family overview')
    .addUserOption((opt) => opt.setName('user').setDescription('User to check (defaults to you)')),

  module: 'family',
  permissionPath: 'family.info',

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

    const targetUser = interaction.options.getUser('user') ?? interaction.user;

    const partner = await getPartner(interaction.guildId!, targetUser.id);
    const parent = await getParent(interaction.guildId!, targetUser.id);
    const children = await getChildren(interaction.guildId!, targetUser.id);
    const siblings = await getSiblings(interaction.guildId!, targetUser.id);

    const container = moduleContainer('family');

    const fields = [
      {
        name: '💍 Partner',
        value: partner ? `<@${partner}>` : 'None',
        inline: true,
      },
      {
        name: '👨 Parent',
        value: parent ? `<@${parent}>` : 'None',
        inline: true,
      },
      {
        name: `👶 Children${children.length > 0 ? ` (${children.length})` : ''}`,
        value: children.length > 0 ? children.map((c) => `<@${c}>`).join(', ') : 'None',
        inline: false,
      },
      {
        name: `👥 Siblings${siblings.length > 0 ? ` (${siblings.length})` : ''}`,
        value: siblings.length > 0 ? siblings.map((s) => `<@${s}>`).join(', ') : 'None',
        inline: false,
      },
    ];

    addFields(container, fields);

    await interaction.reply(v2Payload([container]));
  },
};

export default command;
