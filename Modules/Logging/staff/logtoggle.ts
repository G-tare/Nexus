import { 
  SlashCommandBuilder,
  PermissionFlagsBits,
  inlineCode,
  bold,
  EmbedBuilder, MessageFlags } from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';

const EVENT_TYPES = {
  messages: [
    'messageEdit',
    'messageDelete',
    'messageBulkDelete',
    'messagePin',
  ],
  members: [
    'memberJoin',
    'memberLeave',
    'memberRoleChange',
    'memberNickname',
    'memberTimeout',
  ],
  channels: [
    'channelCreate',
    'channelDelete',
    'channelUpdate',
  ],
  roles: [
    'roleCreate',
    'roleDelete',
    'roleUpdate',
  ],
  server: [
    'serverUpdate',
    'emojiUpdate',
    'stickerUpdate',
  ],
  voice: [
    'voiceJoin',
    'voiceLeave',
    'voiceMove',
    'voiceMute',
    'voiceDeafen',
  ],
  moderation: [
    'memberBan',
    'memberUnban',
    'memberKick',
  ],
  invites: [
    'inviteCreate',
    'inviteDelete',
  ],
  threads: [
    'threadCreate',
    'threadDelete',
    'threadArchive',
  ],
};

const KEBAB_TO_CAMEL: Record<string, string> = {
  'message-edit': 'messageEdit',
  'message-delete': 'messageDelete',
  'message-bulk-delete': 'messageBulkDelete',
  'message-pin': 'messagePin',
  'member-join': 'memberJoin',
  'member-leave': 'memberLeave',
  'member-role-change': 'memberRoleChange',
  'member-nickname': 'memberNickname',
  'member-timeout': 'memberTimeout',
  'channel-create': 'channelCreate',
  'channel-delete': 'channelDelete',
  'channel-update': 'channelUpdate',
  'role-create': 'roleCreate',
  'role-delete': 'roleDelete',
  'role-update': 'roleUpdate',
  'server-update': 'serverUpdate',
  'emoji-update': 'emojiUpdate',
  'sticker-update': 'stickerUpdate',
  'voice-join': 'voiceJoin',
  'voice-leave': 'voiceLeave',
  'voice-move': 'voiceMove',
  'voice-mute': 'voiceMute',
  'voice-deafen': 'voiceDeafen',
  'member-ban': 'memberBan',
  'member-unban': 'memberUnban',
  'member-kick': 'memberKick',
  'invite-create': 'inviteCreate',
  'invite-delete': 'inviteDelete',
  'thread-create': 'threadCreate',
  'thread-delete': 'threadDelete',
  'thread-archive': 'threadArchive',
};

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('logtoggle')
    .setDescription('Toggle logging for specific event types')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('single')
        .setDescription('Toggle a single event type')
        .addStringOption((option) =>
          option
            .setName('event-type')
            .setDescription('Event type to toggle')
            .setRequired(true)
            .addChoices(
              ...[
                'message-edit', 'message-delete', 'message-bulk-delete', 'message-pin',
                'member-join', 'member-leave', 'member-role-change', 'member-nickname', 'member-timeout',
                'channel-create', 'channel-delete', 'channel-update',
                'role-create', 'role-delete', 'role-update',
                'server-update', 'emoji-update', 'sticker-update',
                'voice-join', 'voice-leave', 'voice-move', 'voice-mute', 'voice-deafen',
                'member-ban', 'member-unban',
              ].map((type) => ({ name: type, value: type })),
            ),
        )
        .addBooleanOption((option) =>
          option
            .setName('enabled')
            .setDescription('Enable or disable this event')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('category')
        .setDescription('Toggle an entire category')
        .addStringOption((option) =>
          option
            .setName('category')
            .setDescription('Category to toggle')
            .setRequired(true)
            .addChoices(
              { name: 'messages', value: 'messages' },
              { name: 'members', value: 'members' },
              { name: 'channels', value: 'channels' },
              { name: 'roles', value: 'roles' },
              { name: 'server', value: 'server' },
              { name: 'voice', value: 'voice' },
              { name: 'moderation', value: 'moderation' },
              { name: 'invites', value: 'invites' },
              { name: 'threads', value: 'threads' },
            ),
        )
        .addBooleanOption((option) =>
          option
            .setName('enabled')
            .setDescription('Enable or disable this category')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('all')
        .setDescription('Toggle all events at once')
        .addBooleanOption((option) =>
          option
            .setName('enabled')
            .setDescription('Enable or disable all events')
            .setRequired(true),
        ),
    ),

  module: 'logging',
  permissionPath: 'logging.staff.logtoggle',
  premiumFeature: 'logging.basic',
  async execute(interaction) {
    await interaction.deferReply();

    const guildId = interaction.guildId!;
    const subcommand = interaction.options.getSubcommand();
    const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'logging');
    const config = (_cfgResult?.config ?? {}) as Record<string, any>;

    if (!config.enabledEvents) config.enabledEvents = {};

    if (subcommand === 'single') {
      const eventTypeKebab = interaction.options.getString('event-type', true);
      const enabled = interaction.options.getBoolean('enabled', true);
      const eventType = KEBAB_TO_CAMEL[eventTypeKebab];

      config.enabledEvents[eventType] = enabled;
      await moduleConfig.setConfig(guildId, 'logging', config);

      const status = enabled ? '✓ Enabled' : '✗ Disabled';
      const embed = new EmbedBuilder()
        .setTitle(status)
        .setDescription(`Event type ${inlineCode(eventTypeKebab)} is now ${enabled ? 'enabled' : 'disabled'}`)
        .setColor(enabled ? 'Green' : 'Red');

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'category') {
      const categoryName = interaction.options.getString('category', true) as keyof typeof EVENT_TYPES;
      const enabled = interaction.options.getBoolean('enabled', true);
      const eventTypes = EVENT_TYPES[categoryName];

      eventTypes.forEach((eventType) => {
        config.enabledEvents[eventType] = enabled;
      });
      await moduleConfig.setConfig(guildId, 'logging', config);

      const status = enabled ? '✓ Enabled' : '✗ Disabled';
      const embed = new EmbedBuilder()
        .setTitle(status)
        .setDescription(`Category ${inlineCode(categoryName)} is now ${enabled ? 'enabled' : 'disabled'} (${eventTypes.length} events)`)
        .setColor(enabled ? 'Green' : 'Red');

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'all') {
      const enabled = interaction.options.getBoolean('enabled', true);

      Object.values(EVENT_TYPES).forEach((events) => {
        events.forEach((eventType) => {
          config.enabledEvents[eventType] = enabled;
        });
      });
      await moduleConfig.setConfig(guildId, 'logging', config);

      const status = enabled ? '✓ Enabled' : '✗ Disabled';
      const totalEvents = Object.values(EVENT_TYPES).flat().length;
      const embed = new EmbedBuilder()
        .setTitle(status)
        .setDescription(`All logging is now ${enabled ? 'enabled' : 'disabled'} (${totalEvents} events)`)
        .setColor(enabled ? 'Green' : 'Red');

      return interaction.editReply({ embeds: [embed] });
    }
  },
};

export default command;
