import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  bold,
  inlineCode,
  ContainerBuilder,
  MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';
import { successContainer, warningContainer, infoContainer, addFields, addText, v2Payload } from '../../../Shared/src/utils/componentsV2';

// All supported log event types
const LOG_EVENT_TYPES = [
  'message-edit',
  'message-delete',
  'message-bulk-delete',
  'message-pin',
  'member-join',
  'member-leave',
  'member-role-change',
  'member-nickname',
  'member-timeout',
  'channel-create',
  'channel-delete',
  'channel-update',
  'role-create',
  'role-delete',
  'role-update',
  'server-update',
  'emoji-update',
  'sticker-update',
  'voice-join',
  'voice-leave',
  'voice-move',
  'voice-mute',
  'voice-deafen',
  'member-ban',
  'member-unban',
  'member-kick',
  'invite-create',
  'invite-delete',
  'thread-create',
  'thread-delete',
  'thread-archive',
];

// Discord limits addChoices to 25 — use first 25 as static choices
const LOG_EVENT_CHOICES = LOG_EVENT_TYPES.slice(0, 25).map((type) => ({ name: type, value: type }));

const kebabToCamel = (str: string): string =>
  str.replace(/-([a-z])/g, (match) => match[1].toUpperCase());

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('logchannel')
    .setDescription('Configure channels for logging event types')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('default')
        .setDescription('Set the default log channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('The channel to use as default log channel')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription('Set channel for a specific event type')
        .addStringOption((option) =>
          option
            .setName('event-type')
            .setDescription('Event type to configure')
            .setRequired(true)
            .addChoices(...LOG_EVENT_CHOICES),
        )
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('The channel for this event type')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Remove channel override for an event type')
        .addStringOption((option) =>
          option
            .setName('event-type')
            .setDescription('Event type to remove override for')
            .setRequired(true)
            .addChoices(...LOG_EVENT_CHOICES),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('List all channel assignments'),
    ),

  module: 'logging',
  permissionPath: 'logging.staff.logchannel',
  premiumFeature: 'logging.basic',
  async execute(interaction) {
    await interaction.deferReply();

    const guildId = interaction.guildId!;
    const subcommand = interaction.options.getSubcommand();
    const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'logging');
    const config = (_cfgResult?.config ?? {}) as Record<string, any>;

    if (subcommand === 'default') {
      const channel = interaction.options.getChannel('channel', true);

      config.defaultChannelId = channel.id;
      await moduleConfig.setConfig(guildId, 'logging', config);

      const container = successContainer('Default Log Channel Set');
      addText(container, `Default log channel is now ${channel}`);

      return interaction.editReply(v2Payload([container]));
    }

    if (subcommand === 'set') {
      const eventType = interaction.options.getString('event-type', true);
      const channel = interaction.options.getChannel('channel', true);
      const camelCaseType = kebabToCamel(eventType);

      if (!config.channelMap) config.channelMap = {};
      config.channelMap[camelCaseType] = channel.id;
      await moduleConfig.setConfig(guildId, 'logging', config);

      const container = successContainer('Channel Override Set');
      addFields(container, [
        { name: 'Event Type', value: inlineCode(eventType), inline: true },
        { name: 'Channel', value: channel.toString(), inline: true },
      ]);

      return interaction.editReply(v2Payload([container]));
    }

    if (subcommand === 'remove') {
      const eventType = interaction.options.getString('event-type', true);
      const camelCaseType = kebabToCamel(eventType);

      if (config.channelMap && camelCaseType in config.channelMap) {
        delete config.channelMap[camelCaseType];
        await moduleConfig.setConfig(guildId, 'logging', config);

        const container = successContainer('Channel Override Removed');
        addText(container, `${inlineCode(eventType)} will now use default channel`);

        return interaction.editReply(v2Payload([container]));
      }

      const container = warningContainer('No Override Found');
      addText(container, `No channel override exists for ${inlineCode(eventType)}`);

      return interaction.editReply(v2Payload([container]));
    }

    if (subcommand === 'list') {
      const defaultChannel = config.defaultChannelId
        ? `<#${config.defaultChannelId}>`
        : 'Not set';

      const overridesList =
        config.channelMap && Object.keys(config.channelMap).length > 0
          ? Object.entries(config.channelMap)
              .map(([type, channelId]) => `• ${inlineCode(type)}: <#${channelId}>`)
              .join('\n')
          : 'No overrides configured';

      const container = infoContainer('Log Channel Assignments');
      addFields(container, [
        { name: 'Default Channel', value: defaultChannel },
        { name: 'Event Type Overrides', value: overridesList },
      ]);

      return interaction.editReply(v2Payload([container]));
    }
  },
};

export default command;
