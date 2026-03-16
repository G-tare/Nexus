import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getChildren, getFamilyConfig } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, addText, addFooter, v2Payload } from '../../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('Family');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('children')
    .setDescription('View someone\'s children')
    .addUserOption((opt) => opt.setName('user').setDescription('User to check (defaults to you)')),

  module: 'family',
  permissionPath: 'family.children',

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
    const children = await getChildren(interaction.guildId!, targetUser.id);

    const container = moduleContainer('family');
    if (children.length === 0) {
      addText(container, `### 👶 ${targetUser.username}'s Children\nNo children.`);
    } else {
      addText(container, `### 👶 ${targetUser.username}'s Children\n${children.map((child) => `<@${child}>`).join('\n')}`);
      addFooter(container, `${children.length} child${children.length !== 1 ? 'ren' : ''}`);
    }

    await interaction.reply(v2Payload([container]));
  },
};

export default command;
