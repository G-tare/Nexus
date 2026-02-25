import { 
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType, MessageFlags } from 'discord.js';
import type { BotCommand } from '../../../../Shared/src/types/command';
import { moduleConfig } from '../../../../Shared/src/middleware/moduleConfig';
import { Colors, successEmbed, errorEmbed } from '../../../../Shared/src/utils/embed';

const command: BotCommand = {
  module: 'tickets',
  permissionPath: 'tickets.staff.panellist',
  premiumFeature: 'tickets.basic',
  data: new SlashCommandBuilder()
    .setName('panellist')
    .setDescription('List all active ticket panels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      return interaction.reply({
        content: '❌ This command can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Check permissions
    if (
      !interaction.member ||
      typeof (interaction.member as any).permissions === 'string'
    ) {
      return interaction.reply({
        content: '❌ Unable to verify permissions.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!(interaction.member as any).permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: '❌ You need the **Manage Server** permission.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const _cfgResult = await moduleConfig.getModuleConfig(interaction.guildId!, 'tickets');
    const config = (_cfgResult?.config ?? {}) as any;

    if (!config?.enabled) {
      return interaction.reply({
        content: '❌ The tickets module is not enabled on this server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Check if there are any panels
    if (!config.panels || config.panels.length === 0) {
      return interaction.reply({
        content: '❌ No ticket panels have been created yet.',
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      // Build panel list embed
      const listEmbed = new EmbedBuilder()
        .setTitle('Ticket Panels')
        .setColor('#5865F2')
        .setDescription(
          config.panels.length > 0
            ? `Found ${config.panels.length} active panel(s)`
            : 'No panels found'
        );

      // Add each panel as a field
      for (const panel of config.panels) {
        const channel = interaction.guild.channels.cache.get(panel.channelId);
        const channelMention = channel ? `<#${channel.id}>` : '`Channel not found`';
        const panelType = panel.type.charAt(0).toUpperCase() + panel.type.slice(1);

        const panelInfo = `**Type:** ${panelType}\n**Title:** ${panel.title}\n**Channel:** ${channelMention}\n**[Jump to Message](https://discord.com/channels/${interaction.guildId!}/${panel.channelId}/${panel.messageId})`;

        listEmbed.addFields({
          name: `Panel - ${panel.messageId}`,
          value: panelInfo,
          inline: false,
        });
      }

      listEmbed.setFooter({
        text: `Requested by ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL(),
      });

      listEmbed.setTimestamp();

      return interaction.reply({
        embeds: [listEmbed],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error('[Tickets] Error listing panels:', error);
      return interaction.reply({
        content: '❌ An error occurred while fetching the panel list.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default command;
