import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  inlineCode,
  bold,
  EmbedBuilder,
} from 'discord.js';
import { BotCommand } from '../../../Shared/src/types/command';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';

const EVENT_CATEGORIES = {
  '📨 Messages': [
    'messageEdit',
    'messageDelete',
    'messageBulkDelete',
    'messagePin',
  ],
  '👥 Members': [
    'memberJoin',
    'memberLeave',
    'memberRoleChange',
    'memberNickname',
    'memberTimeout',
  ],
  '📁 Channels': [
    'channelCreate',
    'channelDelete',
    'channelUpdate',
  ],
  '🏷️ Roles': [
    'roleCreate',
    'roleDelete',
    'roleUpdate',
  ],
  '🖥️ Server': [
    'serverUpdate',
    'emojiUpdate',
    'stickerUpdate',
  ],
  '🎙️ Voice': [
    'voiceJoin',
    'voiceLeave',
    'voiceMove',
    'voiceMute',
    'voiceDeafen',
  ],
  '⚔️ Moderation': [
    'memberBan',
    'memberUnban',
    'memberKick',
  ],
  '✉️ Invites': [
    'inviteCreate',
    'inviteDelete',
  ],
  '🧵 Threads': [
    'threadCreate',
    'threadDelete',
    'threadArchive',
  ],
};

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('logconfig')
    .setDescription('View all logging configuration')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  module: 'logging',
  permissionPath: 'logging.staff.logconfig',
  premiumFeature: 'logging.basic',
  ephemeral: true,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId!;
    const _cfgResult = await moduleConfig.getModuleConfig(guildId, 'logging');
    const config = (_cfgResult?.config ?? {}) as Record<string, any>;

    // Initialize defaults
    if (!config.enabledEvents) config.enabledEvents = {};
    if (!config.channelMap) config.channelMap = {};
    if (!config.ignoredChannels) config.ignoredChannels = [];
    if (!config.ignoredRoles) config.ignoredRoles = [];
    if (!config.ignoredUsers) config.ignoredUsers = [];

    // Build enabled/disabled events by category
    const eventStatusFields = Object.entries(EVENT_CATEGORIES).map(
      ([categoryName, events]) => {
        const eventsList = events
          .map((event) => {
            const isEnabled = config.enabledEvents[event] !== false; // Default to enabled
            const emoji = isEnabled ? '✓' : '✗';
            return `${emoji} ${event}`;
          })
          .join('\n');

        return {
          name: categoryName,
          value: eventsList,
          inline: true,
        };
      },
    );

    // Build channel overrides
    const channelOverridesText =
      Object.keys(config.channelMap).length > 0
        ? Object.entries(config.channelMap)
            .map(([type, channelId]) => `• ${inlineCode(type)}: <#${channelId}>`)
            .join('\n')
        : 'No overrides configured';

    const defaultChannel = config.defaultChannelId
      ? `<#${config.defaultChannelId}>`
      : 'Not configured';

    // Build ignored list
    const ignoredChannelsText =
      config.ignoredChannels.length > 0
        ? config.ignoredChannels.map((id: any) => `<#${id}>`).join(', ')
        : 'None';

    const ignoredRolesText =
      config.ignoredRoles.length > 0
        ? config.ignoredRoles.map((id: any) => `<@&${id}>`).join(', ')
        : 'None';

    const ignoredUsersText =
      config.ignoredUsers.length > 0
        ? config.ignoredUsers.map((id: any) => `<@${id}>`).join(', ')
        : 'None';

    // Create main embed
    const mainEmbed = new EmbedBuilder()
      .setTitle('📊 Logging Configuration')
      .setColor('Blurple')
      .addFields(
        {
          name: '🎯 Default Channel',
          value: defaultChannel,
          inline: false,
        },
        {
          name: '📍 Channel Overrides',
          value: channelOverridesText,
          inline: false,
        },
        ...eventStatusFields,
      );

    // Create ignored items embed
    const ignoredEmbed = new EmbedBuilder()
      .setTitle('🚫 Ignored from Logging')
      .setColor('Blurple')
      .addFields(
        {
          name: `Channels (${config.ignoredChannels.length})`,
          value: ignoredChannelsText,
          inline: false,
        },
        {
          name: `Roles (${config.ignoredRoles.length})`,
          value: ignoredRolesText,
          inline: false,
        },
        {
          name: `Users (${config.ignoredUsers.length})`,
          value: ignoredUsersText,
          inline: false,
        },
      );

    return interaction.editReply({ embeds: [mainEmbed, ignoredEmbed] });
  },
};

export default command;
