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
  permissionPath: 'tickets.staff.ticketpanel',
  premiumFeature: 'tickets.basic',
  data: new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Create a ticket creation panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Panel type')
        .setRequired(true)
        .addChoices(
          { name: 'Button', value: 'button' },
          { name: 'Dropdown', value: 'dropdown' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('title')
        .setDescription('Panel title (max 256 characters)')
        .setRequired(true)
        .setMaxLength(256)
    )
    .addStringOption((option) =>
      option
        .setName('description')
        .setDescription('Panel description (max 4000 characters)')
        .setRequired(true)
        .setMaxLength(4000)
    )
    .addStringOption((option) =>
      option
        .setName('color')
        .setDescription('Panel embed color (hex code, e.g. #FF5733)')
        .setRequired(false)
    )
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Channel to post panel in (defaults to current)')
        .setRequired(false)
        .addChannelTypes(ChannelType.GuildText)
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

    const type = interaction.options.getString('type', true) as 'button' | 'dropdown';
    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);
    let color = interaction.options.getString('color') || '#5865F2';
    const targetChannel = interaction.options.getChannel('channel') ||
      (interaction.channel as TextChannel);

    // Validate channel
    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
      return interaction.editReply('❌ Invalid target channel.');
    }

    // Validate color
    if (!/^#[0-9A-F]{6}$/i.test(color)) {
      return interaction.editReply('❌ Invalid color format. Use hex (e.g., #FF5733).');
    }

    // Check if categories exist
    if (!config.categories || config.categories.length === 0) {
      return interaction.editReply(
        '❌ No ticket categories configured. Set up categories first.'
      );
    }

    try {
      // Build panel embed
      const panelObj = {
        title,
        description,
        color,
        type,
        messageId: '',
        channelId: (targetChannel as any).id,
        categoryIds: config.categories?.map((c: any) => c.id) || []
      };
      const { embed, components } = buildPanelEmbed(
        panelObj as any,
        config.categories || []
      );

      // Send panel to target channel
      const panelMessage = await (targetChannel as any).send({
        embeds: [embed],
        components,
      });

      // Save panel to config
      if (!config.panels) {
        config.panels = [];
      }

      config.panels.push({
        messageId: panelMessage.id,
        channelId: targetChannel.id,
        type,
        title,
        description,
        color,
        createdAt: new Date().toISOString(),
      });

      moduleConfig.setConfig(interaction.guildId!, 'tickets', config);

      return interaction.editReply(
        `✅ Panel created! [Jump to message](${panelMessage.url})`
      );
    } catch (error) {
      console.error('[Tickets] Error creating panel:', error);
      return interaction.editReply(
        '❌ An error occurred while creating the panel.'
      );
    }
  },
};

export default command;
