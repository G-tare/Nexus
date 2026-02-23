import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
} from 'discord.js';
import type { BotCommand } from '../../../../Shared/src/types/command';
import { buildPanelEmbed } from '../../helpers';
import { moduleConfig } from '../../../../Shared/src/middleware/moduleConfig';

const command: BotCommand = {
  module: 'tickets',
  permissionPath: 'tickets.staff.paneledit',
  premiumFeature: 'tickets.advanced',
  data: new SlashCommandBuilder()
    .setName('paneledit')
    .setDescription('Edit an existing ticket panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName('message-id')
        .setDescription('Message ID of the panel to edit')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('title')
        .setDescription('New panel title (max 256 characters)')
        .setRequired(false)
        .setMaxLength(256)
    )
    .addStringOption((option) =>
      option
        .setName('description')
        .setDescription('New panel description (max 4000 characters)')
        .setRequired(false)
        .setMaxLength(4000)
    )
    .addStringOption((option) =>
      option
        .setName('color')
        .setDescription('New panel embed color (hex code, e.g. #FF5733)')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId || !interaction.guild) {
      return interaction.reply({
        content: '❌ This command can only be used in a server.',
        ephemeral: true,
      });
    }

    // Check permissions
    if (
      !interaction.member ||
      typeof (interaction.member as any).permissions === 'string'
    ) {
      return interaction.reply({
        content: '❌ Unable to verify permissions.',
        ephemeral: true,
      });
    }

    if (!(interaction.member as any).permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: '❌ You need the **Manage Server** permission.',
        ephemeral: true,
      });
    }

    const _cfgResult = await moduleConfig.getModuleConfig(interaction.guildId!, 'tickets');
    const config = (_cfgResult?.config ?? {}) as any;

    if (!config?.enabled) {
      return interaction.reply({
        content: '❌ The tickets module is not enabled on this server.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const messageId = interaction.options.getString('message-id', true);
    const newTitle = interaction.options.getString('title');
    const newDescription = interaction.options.getString('description');
    let newColor = interaction.options.getString('color');

    // Find panel in config
    const panelIndex = (config.panels || []).findIndex(
      (p: any) => p.messageId === messageId
    );

    if (panelIndex === -1) {
      return interaction.editReply(
        '❌ Panel not found. Check the message ID and try again.'
      );
    }

    const panel = config.panels![panelIndex];

    // Validate color if provided
    if (newColor && !/^#[0-9A-F]{6}$/i.test(newColor)) {
      return interaction.editReply('❌ Invalid color format. Use hex (e.g., #FF5733).');
    }

    // Update panel properties
    const updatedTitle = newTitle || panel.title;
    const updatedDescription = newDescription || panel.description;
    const updatedColor = newColor || panel.color;

    try {
      // Get the channel and message
      const targetChannel = interaction.guild.channels.cache.get(
        panel.channelId
      );

      if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
        return interaction.editReply(
          '❌ Panel channel not found or invalid.'
        );
      }

      const textChannel = targetChannel as TextChannel;
      const message = await textChannel.messages.fetch(panel.messageId);

      if (!message) {
        return interaction.editReply('❌ Panel message not found.');
      }

      // Build updated embed
      const updatedPanel = { ...panel, title: updatedTitle, description: updatedDescription, color: updatedColor };
      const { embed, components } = buildPanelEmbed(
        updatedPanel,
        config.categories || []
      );

      // Edit the message
      await message.edit({ embeds: [embed], components });

      // Update config
      panel.title = updatedTitle;
      panel.description = updatedDescription;
      panel.color = updatedColor;

      moduleConfig.setConfig(interaction.guildId!, 'tickets', config);

      return interaction.editReply('✅ Panel updated successfully.');
    } catch (error) {
      console.error('[Tickets] Error editing panel:', error);
      return interaction.editReply(
        '❌ An error occurred while editing the panel.'
      );
    }
  },
};

export default command;
