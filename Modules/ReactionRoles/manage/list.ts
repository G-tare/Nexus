import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  ChannelType,
  MessageFlags } from 'discord.js';
import { getReactionRolesConfig } from '../helpers';
import { moduleContainer, addText, addFields, v2Payload, paginatedContainer } from '../../../Shared/src/utils/componentsV2';

const BotCommand = {
  data: new SlashCommandBuilder()
    .setName('rr-list')
    .setDescription('List all reaction role panels in this server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  module: 'reactionroles',
  permissionPath: 'reactionroles.rr-list',
  premiumFeature: 'reactionroles.basic',

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.member) {
      return interaction.reply({
        content: '❌ This command can only be used in a server.',
      });
    }

    await interaction.deferReply({});

    try {
      const config = await getReactionRolesConfig(interaction.guildId!);

      if (config.panels.length === 0) {
        return interaction.editReply('❌ No reaction role panels found in this server.');
      }

      const panelTexts: string[] = [];

      for (const panel of config.panels) {
        const channel = await interaction.guild.channels.fetch(panel.channelId).catch(() => null);
        const channelName = channel ? `#${(channel as any).name || 'unknown'}` : 'Unknown Channel';

        const fieldValue = [
          `**ID:** \`${panel.id}\``,
          `**Type:** ${panel.type}`,
          `**Mode:** ${panel.mode}`,
          `**Channel:** ${channelName}`,
          `**Roles:** ${panel.roles.length}`,
          `**Max Roles:** ${panel.maxRoles === 0 ? 'Unlimited' : panel.maxRoles}`,
          `[Jump to Message](https://discord.com/channels/${panel.guildId}/${panel.channelId}/${panel.messageId})`,
        ].join('\n');

        panelTexts.push(`**${panel.title}**\n${fieldValue}`);
      }

      const { container, totalPages } = paginatedContainer(
        panelTexts,
        0,
        6,
        '📋 Reaction Role Panels'
      );

      await interaction.editReply(v2Payload([container]));
    } catch (error) {
      console.error('Error listing panels:', error);
      await interaction.editReply({
        content: `❌ Error: ${error instanceof Error ? (error as any).message : 'Unknown error'}`,
      });
    }
  },
};

export default BotCommand;
