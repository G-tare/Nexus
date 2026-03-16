import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { getPartner, getRelationship, getFamilyConfig } from '../helpers';
import { createModuleLogger } from '../../../Shared/src/utils/logger';
import { moduleContainer, addText, addFooter, errorContainer, v2Payload } from '../../../Shared/src/utils/componentsV2';

const logger = createModuleLogger('Family');

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('partner')
    .setDescription('View someone\'s partner')
    .addUserOption((opt) => opt.setName('user').setDescription('User to check (defaults to you)')),

  module: 'family',
  permissionPath: 'family.partner',

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

    if (!partner) {
      const container = errorContainer('No Partner', `${targetUser.username} is not married to anyone.`);
      await interaction.reply(v2Payload([container]));
      return;
    }

    const relation = await getRelationship(interaction.guildId!, targetUser.id);

    const container = moduleContainer('family');
    addText(container, `### 💍 ${targetUser.username}'s Partner\n<@${partner}>`);
    if (relation?.marriedAt) {
      addFooter(container, `Married since ${relation.marriedAt.toLocaleDateString()}`);
    } else {
      addFooter(container, 'Marriage date unknown');
    }

    await interaction.reply(v2Payload([container]));
  },
};

export default command;
