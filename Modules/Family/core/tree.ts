import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { buildFamilyTree, getFamilyConfig } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('Family');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('tree')
    .setDescription('View family tree')
    .addUserOption((opt) => opt.setName('user').setDescription('User to view (defaults to you)')),

  module: 'family',
  permissionPath: 'family.tree',

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
    const tree = await buildFamilyTree(interaction.guildId!, targetUser.id);

    const container = moduleContainer('family');
    addText(container, `### ${targetUser.username}'s Family Tree\n\`\`\`\n${tree}\n\`\`\``);

    await interaction.reply(v2Payload([container]));
  },
};

export default command;
