import {
  Client,
  Events,
  Message,
  GuildMember,
  VoiceState,
  GuildChannel,
  Role,
  Guild,
  AuditLogEvent,
  ContainerBuilder,
  Collection,
  Snowflake,
  GuildEmoji,
  Sticker,
  Invite,
  ThreadChannel,
  PartialMessage,
  PartialGuildMember,
  GuildBan,
  NonThreadGuildBasedChannel,
  ChannelType,
  PermissionFlagsBits,
  TextBasedChannel,
} from 'discord.js';
import { ModuleEvent } from '../../Shared/src/types/command';
import {
  getLoggingConfig,
  isEventEnabled,
  isIgnored,
  sendLogEmbed,
  getLogColor,
  formatDiff,
  truncateText,
  buildMessageDeleteEmbed,
  buildBulkDeleteEmbed,
  buildMessageEditEmbed,
  LogEventType,
} from './helpers';
import {
  moduleContainer,
  addText,
  addFields,
  addSeparator,
  addFooter,
  addSectionWithThumbnail,
  v2Payload,
  V2Colors,
} from '../../Shared/src/utils/componentsV2';
import { createModuleLogger } from '../../Shared/src/utils/logger';

const logger = createModuleLogger('Logging:Events');

// ============================================================================
// MESSAGE EVENTS
// ============================================================================

const messageEditHandler = async (oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) => {
  try {
    // Skip bots, DMs, and partial messages
    if (!newMessage.guild || newMessage.author?.bot || !newMessage.content) return;

    const config = await getLoggingConfig(newMessage.guild.id);
    if (!config || !isEventEnabled(config, 'messageEdit')) return;

    // Skip if content unchanged
    if (oldMessage.content === newMessage.content) return;

    // Check if author is ignored
    if (isIgnored(config, 'user', newMessage.author?.id)) return;
    if (isIgnored(config, 'channel', newMessage.channel?.id)) return;

    const embed = buildMessageEditEmbed(oldMessage as Message, newMessage as Message, config);
    await sendLogEmbed(newMessage.guild, embed, config, 'messageEdit');
  } catch (error) {
    logger.error('Error in messageEditHandler:', error);
  }
};

const messageDeleteHandler = async (message: Message | PartialMessage) => {
  try {
    // Skip bots, DMs, and partial messages
    if (!message.guild || message.author?.bot) return;
    if (isIgnored(await getLoggingConfig(message.guild.id), 'user', message.author?.id)) return;

    const config = await getLoggingConfig(message.guild.id);
    if (!config || !isEventEnabled(config, 'messageDelete')) return;

    const embed = buildMessageDeleteEmbed(message as Message);
    await sendLogEmbed(message.guild, embed, config, 'messageDelete');
  } catch (error) {
    logger.error('Error in messageDeleteHandler:', error);
  }
};

const messageBulkDeleteHandler = async (messages: Collection<Snowflake, Message | PartialMessage>) => {
  try {
    // Get first message to access guild
    const firstMessage = messages.first();
    if (!firstMessage?.guild) return;

    const guild = firstMessage.guild;
    const config = await getLoggingConfig(guild.id);
    if (!config || !isEventEnabled(config, 'messageBulkDelete')) return;

    // Filter out bot messages and ignored users
    const filteredMessages = messages.filter((msg) => {
      if (msg.author?.bot) return false;
      if (isIgnored(config, 'user', msg.author?.id)) return false;
      return true;
    });

    if (filteredMessages.size === 0) return;

    const embed = buildBulkDeleteEmbed(Array.from(filteredMessages.values()).map(m => ({ content: m.content || "", author: { username: m.author?.username || "Unknown" } })), firstMessage.channelId || "", firstMessage.channel?.toString() || "");
    await sendLogEmbed(guild, embed, config, 'messageBulkDelete');
  } catch (error) {
    logger.error('Error in messageBulkDeleteHandler:', error);
  }
};

const messagePinHandler = async (channel: TextBasedChannel, message: Message) => {
  try {
    if (!channel.isTextBased() || !message.guild) return;

    const config = await getLoggingConfig(message.guild.id);
    if (!config || !isEventEnabled(config, 'messagePin')) return;

    if (isIgnored(config, 'user', message.author.id) || isIgnored(config, 'channel', channel.id)) return;

    // Check audit log for who pinned the message
    let pinner: GuildMember | null = null;
    try {
      const auditLogs = await message.guild.fetchAuditLogs({ type: AuditLogEvent.MessagePin, limit: 5 });
      const pinLog = auditLogs.entries.find(
        (entry) => entry.targetId === message.id && entry.executor?.id !== message.author.id,
      );
      if (pinLog?.executor) {
        pinner = await message.guild.members.fetch(pinLog.executor.id).catch(() => null);
      }
    } catch {
      // If audit log fetch fails, continue without it
    }

    const container = new ContainerBuilder().setAccentColor(getLogColor('messagePin'));
    addText(container, '### Message Pinned');
    addSeparator(container, 'small');

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      {
        name: 'Channel',
        value: `${channel}`,
        inline: false,
      },
      {
        name: 'Author',
        value: `${message.author.tag} (${message.author.id})`,
        inline: false,
      },
      {
        name: 'Content',
        value: truncateText(message.content || '*No text content*', 1024),
        inline: false,
      },
    ];

    if (pinner) {
      fields.push({
        name: 'Pinned By',
        value: `${pinner.user.tag} (${pinner.id})`,
        inline: false,
      });
    }

    addFields(container, fields);
    addFooter(container, `[Jump to Message](${message.url})`);
    await sendLogEmbed(message.guild, container, config, 'messagePin');
  } catch (error) {
    logger.error('Error in messagePinHandler:', error);
  }
};

// ============================================================================
// MEMBER EVENTS
// ============================================================================

const memberJoinHandler = async (member: GuildMember) => {
  try {
    const config = await getLoggingConfig(member.guild.id);
    if (!config || !isEventEnabled(config, 'memberJoin')) return;

    if (isIgnored(config, 'user', member.id)) return;

    const createdTimestamp = Math.floor(member.user.createdTimestamp / 1000);
    const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24));

    const container = new ContainerBuilder().setAccentColor(getLogColor('memberJoin'));
    addSectionWithThumbnail(
      container,
      '### Member Joined',
      member.user.displayAvatarURL({ size: 256 })
    );
    addSeparator(container, 'small');

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: 'Username', value: member.user.tag, inline: true },
      { name: 'User ID', value: member.id, inline: true },
      { name: 'Account Created', value: `<t:${createdTimestamp}:F>\n(${accountAge} days old)`, inline: false },
      { name: 'Member Count', value: `Now ${member.guild.memberCount} members`, inline: true },
    ];

    addFields(container, fields);
    await sendLogEmbed(member.guild, container, config, 'memberJoin');
  } catch (error) {
    logger.error('Error in memberJoinHandler:', error);
  }
};

const memberLeaveHandler = async (member: GuildMember | PartialGuildMember) => {
  try {
    const config = await getLoggingConfig(member.guild.id);
    if (!config || !isEventEnabled(config, 'memberLeave')) return;

    if (isIgnored(config, 'user', member.id)) return;

    // Try to fetch full member data if partial
    let fullMember = member;
    if (member.partial) {
      try {
        fullMember = await member.guild.members.fetch(member.id);
      } catch {
        // If fetch fails, use partial data
      }
    }

    const joinedTimestamp = fullMember.joinedTimestamp
      ? Math.floor(fullMember.joinedTimestamp / 1000)
      : null;
    const timeInServer = fullMember.joinedAt
      ? Math.floor((Date.now() - fullMember.joinedTimestamp!) / (1000 * 60 * 60 * 24))
      : 0;

    // Try to determine if this was a kick
    let wasKicked = false;
    try {
      const auditLogs = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 5 });
      wasKicked = auditLogs.entries.some((entry) => entry.targetId === member.id);
    } catch {
      // If audit log fetch fails, continue
    }

    const eventType = wasKicked ? 'memberKick' : 'memberLeave';
    const container = new ContainerBuilder().setAccentColor(getLogColor(eventType));

    addSectionWithThumbnail(
      container,
      `### ${wasKicked ? 'Member Kicked' : 'Member Left'}`,
      member.user?.displayAvatarURL({ size: 256 }) || ''
    );
    addSeparator(container, 'small');

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: 'Username', value: member.user?.tag || 'Unknown User', inline: true },
      { name: 'User ID', value: member.id, inline: true },
    ];

    if (joinedTimestamp) {
      fields.push({
        name: 'Time in Server',
        value: `${timeInServer} days`,
        inline: true,
      });
    }

    if (fullMember.roles?.cache && fullMember.roles.cache.size > 1) {
      const roleList = fullMember.roles.cache
        .filter((r) => r.id !== member.guild.id)
        .map((r) => r.toString())
        .join(', ');
      if (roleList) {
        fields.push({
          name: `Roles (${fullMember.roles.cache.size - 1})`,
          value: truncateText(roleList, 1024),
          inline: false,
        });
      }
    }

    addFields(container, fields);
    await sendLogEmbed(member.guild, container, config, eventType);
  } catch (error) {
    logger.error('Error in memberLeaveHandler:', error);
  }
};

const memberRoleChangeHandler = async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
  try {
    const config = await getLoggingConfig(newMember.guild.id);
    if (!config || !isEventEnabled(config, 'memberRoleChange')) return;

    if (isIgnored(config, 'user', newMember.id)) return;

    const oldRoles = oldMember.roles?.cache ?? new Collection();
    const newRoles = newMember.roles.cache;

    const addedRoles = newRoles.filter((r) => !oldRoles.has(r.id));
    const removedRoles = oldRoles.filter((r) => !newRoles.has(r.id));

    if (addedRoles.size === 0 && removedRoles.size === 0) return;

    const container = new ContainerBuilder().setAccentColor(getLogColor('memberRoleChange'));
    addSectionWithThumbnail(
      container,
      '### Member Roles Changed',
      newMember.user.displayAvatarURL({ size: 256 })
    );
    addSeparator(container, 'small');

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      {
        name: 'Member',
        value: `${newMember.user.tag} (${newMember.id})`,
        inline: false,
      },
    ];

    if (addedRoles.size > 0) {
      fields.push({
        name: `Roles Added (${addedRoles.size})`,
        value: truncateText(addedRoles.map((r) => r.toString()).join(', '), 1024),
        inline: false,
      });
    }

    if (removedRoles.size > 0) {
      fields.push({
        name: `Roles Removed (${removedRoles.size})`,
        value: truncateText(removedRoles.map((r) => r.toString()).join(', '), 1024),
        inline: false,
      });
    }

    addFields(container, fields);
    await sendLogEmbed(newMember.guild, container, config, 'memberRoleChange');
  } catch (error) {
    logger.error('Error in memberRoleChangeHandler:', error);
  }
};

const memberNicknameHandler = async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
  try {
    const config = await getLoggingConfig(newMember.guild.id);
    if (!config || !isEventEnabled(config, 'memberNicknameChange')) return;

    if (isIgnored(config, 'user', newMember.id)) return;

    const oldNickname = oldMember.nickname ?? 'No nickname';
    const newNickname = newMember.nickname ?? 'No nickname';

    if (oldNickname === newNickname) return;

    const container = new ContainerBuilder().setAccentColor(getLogColor('memberNicknameChange'));
    addSectionWithThumbnail(
      container,
      '### Member Nickname Changed',
      newMember.user.displayAvatarURL({ size: 256 })
    );
    addSeparator(container, 'small');

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      {
        name: 'Member',
        value: `${newMember.user.tag} (${newMember.id})`,
        inline: false,
      },
      {
        name: 'Before → After',
        value: formatDiff('Nickname', oldNickname, newNickname),
        inline: false,
      },
    ];

    addFields(container, fields);
    await sendLogEmbed(newMember.guild, container, config, 'memberNicknameChange');
  } catch (error) {
    logger.error('Error in memberNicknameHandler:', error);
  }
};

const memberTimeoutHandler = async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
  try {
    const config = await getLoggingConfig(newMember.guild.id);
    if (!config || !isEventEnabled(config, 'memberTimeout')) return;

    if (isIgnored(config, 'user', newMember.id)) return;

    const oldTimeout = oldMember.communicationDisabledUntil;
    const newTimeout = newMember.communicationDisabledUntil;

    // Check if timeout status actually changed
    if (oldTimeout?.getTime() === newTimeout?.getTime()) return;

    const isTimedOut = newTimeout && newTimeout > new Date();

    const container = new ContainerBuilder().setAccentColor(getLogColor('memberTimeout'));
    addSectionWithThumbnail(
      container,
      `### ${isTimedOut ? 'Member Timed Out' : 'Member Timeout Removed'}`,
      newMember.user.displayAvatarURL({ size: 256 })
    );
    addSeparator(container, 'small');

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      {
        name: 'Member',
        value: `${newMember.user.tag} (${newMember.id})`,
        inline: false,
      },
    ];

    if (isTimedOut && newTimeout) {
      const durationMs = newTimeout.getTime() - Date.now();
      const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));
      const durationHours = Math.floor((durationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      fields.push(
        {
          name: 'Timeout Until',
          value: `<t:${Math.floor(newTimeout.getTime() / 1000)}:F>`,
          inline: false,
        },
        {
          name: 'Duration',
          value: `${durationDays}d ${durationHours}h`,
          inline: true,
        },
      );
    }

    addFields(container, fields);
    await sendLogEmbed(newMember.guild, container, config, 'memberTimeout');
  } catch (error) {
    logger.error('Error in memberTimeoutHandler:', error);
  }
};

// ============================================================================
// CHANNEL EVENTS
// ============================================================================

const channelCreateHandler = async (channel: NonThreadGuildBasedChannel) => {
  try {
    if (!channel.guild) return;

    const config = await getLoggingConfig(channel.guild.id);
    if (!config || !isEventEnabled(config, 'channelCreate')) return;

    if (isIgnored(config, 'channel', channel.id)) return;

    let creator: GuildMember | null = null;
    try {
      const auditLogs = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelCreate, limit: 5 });
      const createLog = auditLogs.entries.find((entry) => entry.targetId === channel.id);
      if (createLog?.executor) {
        creator = await channel.guild.members.fetch(createLog.executor.id).catch(() => null);
      }
    } catch {
      // If audit log fetch fails, continue
    }

    const typeNames: any = {
      [ChannelType.GuildText]: 'Text',
      [ChannelType.GuildVoice]: 'Voice',
      [ChannelType.GuildCategory]: 'Category',
      [ChannelType.GuildAnnouncement]: 'Announcement',
      [ChannelType.GuildStageVoice]: 'Stage',
      [ChannelType.GuildForum]: 'Forum',
      [ChannelType.DM]: 'DM',
      [ChannelType.GroupDM]: 'Group DM',
      [ChannelType.PrivateThread]: 'Private Thread',
      [ChannelType.PublicThread]: 'Public Thread',
      [ChannelType.AnnouncementThread]: 'Announcement Thread',
    };

    const container = new ContainerBuilder().setAccentColor(getLogColor('channelCreate'));
    addText(container, '### Channel Created');
    addSeparator(container, 'small');

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: 'Channel', value: `${channel.toString()} (${channel.id})`, inline: false },
      { name: 'Type', value: typeNames[channel.type] || 'Unknown', inline: true },
    ];

    if ('parent' in channel && channel.parent) {
      fields.push({
        name: 'Category',
        value: channel.parent.name,
        inline: true,
      });
    }

    if (creator) {
      fields.push({
        name: 'Created By',
        value: `${creator.user.tag} (${creator.id})`,
        inline: false,
      });
    }

    addFields(container, fields);
    await sendLogEmbed(channel.guild, container, config, 'channelCreate');
  } catch (error) {
    logger.error('Error in channelCreateHandler:', error);
  }
};

const channelDeleteHandler = async (channel: NonThreadGuildBasedChannel) => {
  try {
    if (!channel.guild) return;

    const config = await getLoggingConfig(channel.guild.id);
    if (!config || !isEventEnabled(config, 'channelDelete')) return;

    if (isIgnored(config, 'channel', channel.id)) return;

    const typeNames: any = {
      [ChannelType.GuildText]: 'Text',
      [ChannelType.GuildVoice]: 'Voice',
      [ChannelType.GuildCategory]: 'Category',
      [ChannelType.GuildAnnouncement]: 'Announcement',
      [ChannelType.GuildStageVoice]: 'Stage',
      [ChannelType.GuildForum]: 'Forum',
      [ChannelType.DM]: 'DM',
      [ChannelType.GroupDM]: 'Group DM',
      [ChannelType.PrivateThread]: 'Private Thread',
      [ChannelType.PublicThread]: 'Public Thread',
      [ChannelType.AnnouncementThread]: 'Announcement Thread',
    };

    const container = new ContainerBuilder().setAccentColor(getLogColor('channelDelete'));
    addText(container, '### Channel Deleted');
    addSeparator(container, 'small');

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: 'Channel', value: channel.name || 'Unknown', inline: false },
      { name: 'Channel ID', value: channel.id, inline: true },
      { name: 'Type', value: typeNames[channel.type] || 'Unknown', inline: true },
    ];

    if ('parent' in channel && channel.parent) {
      fields.push({
        name: 'Category',
        value: channel.parent.name,
        inline: true,
      });
    }

    addFields(container, fields);
    await sendLogEmbed(channel.guild, container, config, 'channelDelete');
  } catch (error) {
    logger.error('Error in channelDeleteHandler:', error);
  }
};

const channelUpdateHandler = async (oldChannel: NonThreadGuildBasedChannel, newChannel: NonThreadGuildBasedChannel) => {
  try {
    if (!newChannel.guild) return;

    const config = await getLoggingConfig(newChannel.guild.id);
    if (!config || !isEventEnabled(config, 'channelUpdate')) return;

    if (isIgnored(config, 'channel', newChannel.id)) return;

    const changes: Array<{ field: string; before: string; after: string }> = [];

    // Check for name change
    if ('name' in oldChannel && 'name' in newChannel && oldChannel.name !== newChannel.name) {
      changes.push({
        field: 'Name',
        before: oldChannel.name,
        after: newChannel.name,
      });
    }

    // Check for topic change (text channels)
    if ('topic' in oldChannel && 'topic' in newChannel && oldChannel.topic !== newChannel.topic) {
      changes.push({
        field: 'Topic',
        before: oldChannel.topic || 'No topic',
        after: newChannel.topic || 'No topic',
      });
    }

    // Check for NSFW change
    if ('nsfw' in oldChannel && 'nsfw' in newChannel && oldChannel.nsfw !== newChannel.nsfw) {
      changes.push({
        field: 'NSFW',
        before: oldChannel.nsfw ? 'Yes' : 'No',
        after: newChannel.nsfw ? 'Yes' : 'No',
      });
    }

    // Check for slowmode change
    if (
      'rateLimitPerUser' in oldChannel &&
      'rateLimitPerUser' in newChannel &&
      oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser
    ) {
      changes.push({
        field: 'Slowmode',
        before: oldChannel.rateLimitPerUser ? `${oldChannel.rateLimitPerUser}s` : 'Disabled',
        after: newChannel.rateLimitPerUser ? `${newChannel.rateLimitPerUser}s` : 'Disabled',
      });
    }

    // Check for bitrate change (voice channels)
    if ('bitrate' in oldChannel && 'bitrate' in newChannel && oldChannel.bitrate !== newChannel.bitrate) {
      changes.push({
        field: 'Bitrate',
        before: `${oldChannel.bitrate ? oldChannel.bitrate / 1000 : 0}kbps`,
        after: `${newChannel.bitrate ? newChannel.bitrate / 1000 : 0}kbps`,
      });
    }

    // Check for user limit change (voice channels)
    if ('userLimit' in oldChannel && 'userLimit' in newChannel && oldChannel.userLimit !== newChannel.userLimit) {
      changes.push({
        field: 'User Limit',
        before: String(oldChannel.userLimit || 'Unlimited'),
        after: String(newChannel.userLimit || 'Unlimited'),
      });
    }

    if (changes.length === 0) return;

    const container = new ContainerBuilder().setAccentColor(getLogColor('channelUpdate'));
    addText(container, '### Channel Updated');
    addSeparator(container, 'small');

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      {
        name: 'Channel',
        value: `${newChannel.toString()} (${newChannel.id})`,
        inline: false,
      },
    ];

    for (const change of changes) {
      fields.push({
        name: change.field,
        value: formatDiff('Change', change.before, change.after),
        inline: false,
      });
    }

    addFields(container, fields);
    await sendLogEmbed(newChannel.guild, container, config, 'channelUpdate');
  } catch (error) {
    logger.error('Error in channelUpdateHandler:', error);
  }
};

// ============================================================================
// ROLE EVENTS
// ============================================================================

const roleCreateHandler = async (role: Role) => {
  try {
    const config = await getLoggingConfig(role.guild.id);
    if (!config || !isEventEnabled(config, 'roleCreate')) return;

    if (isIgnored(config, 'role', role.id)) return;

    let creator: GuildMember | null = null;
    try {
      const auditLogs = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleCreate, limit: 5 });
      const createLog = auditLogs.entries.find((entry) => entry.targetId === role.id);
      if (createLog?.executor) {
        creator = await role.guild.members.fetch(createLog.executor.id).catch(() => null);
      }
    } catch {
      // If audit log fetch fails, continue
    }

    const container = new ContainerBuilder().setAccentColor(role.color || getLogColor('roleCreate'));
    addText(container, '### Role Created');
    addSeparator(container, 'small');

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: 'Role', value: `${role.toString()} (${role.id})`, inline: false },
      {
        name: 'Permissions',
        value: role.permissions.bitfield === 0n ? 'No permissions' : `\`${role.permissions.bitfield}\``,
        inline: false,
      },
      {
        name: 'Mentionable',
        value: role.mentionable ? 'Yes' : 'No',
        inline: true,
      },
      {
        name: 'Hoisted',
        value: role.hoist ? 'Yes' : 'No',
        inline: true,
      },
    ];

    if (creator) {
      fields.push({
        name: 'Created By',
        value: `${creator.user.tag} (${creator.id})`,
        inline: false,
      });
    }

    addFields(container, fields);
    await sendLogEmbed(role.guild, container, config, 'roleCreate');
  } catch (error) {
    logger.error('Error in roleCreateHandler:', error);
  }
};

const roleDeleteHandler = async (role: Role) => {
  try {
    const config = await getLoggingConfig(role.guild.id);
    if (!config || !isEventEnabled(config, 'roleDelete')) return;

    if (isIgnored(config, 'role', role.id)) return;

    const container = new ContainerBuilder().setAccentColor(role.color || getLogColor('roleDelete'));
    addText(container, '### Role Deleted');
    addSeparator(container, 'small');

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: 'Role Name', value: role.name, inline: false },
      { name: 'Role ID', value: role.id, inline: true },
      { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
      { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
    ];

    addFields(container, fields);
    await sendLogEmbed(role.guild, container, config, 'roleDelete');
  } catch (error) {
    logger.error('Error in roleDeleteHandler:', error);
  }
};

const roleUpdateHandler = async (oldRole: Role, newRole: Role) => {
  try {
    const config = await getLoggingConfig(newRole.guild.id);
    if (!config || !isEventEnabled(config, 'roleUpdate')) return;

    if (isIgnored(config, 'role', newRole.id)) return;

    const changes: Array<{ field: string; before: string; after: string }> = [];

    if (oldRole.name !== newRole.name) {
      changes.push({
        field: 'Name',
        before: oldRole.name,
        after: newRole.name,
      });
    }

    if (oldRole.color !== newRole.color) {
      changes.push({
        field: 'Color',
        before: oldRole.color ? `#${oldRole.color.toString(16).padStart(6, '0').toUpperCase()}` : 'Default',
        after: newRole.color ? `#${newRole.color.toString(16).padStart(6, '0').toUpperCase()}` : 'Default',
      });
    }

    if (oldRole.mentionable !== newRole.mentionable) {
      changes.push({
        field: 'Mentionable',
        before: oldRole.mentionable ? 'Yes' : 'No',
        after: newRole.mentionable ? 'Yes' : 'No',
      });
    }

    if (oldRole.hoist !== newRole.hoist) {
      changes.push({
        field: 'Hoisted',
        before: oldRole.hoist ? 'Yes' : 'No',
        after: newRole.hoist ? 'Yes' : 'No',
      });
    }

    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
      // Get human-readable permission differences
      const oldPerms = oldRole.permissions;
      const newPerms = newRole.permissions;

      const addedPerms: string[] = [];
      const removedPerms: string[] = [];

      // Check each permission flag
      for (const [permName, permBit] of Object.entries(PermissionFlagsBits)) {
        const hadPerm = oldPerms.has(permBit as bigint);
        const hasPerm = newPerms.has(permBit as bigint);

        if (!hadPerm && hasPerm) {
          addedPerms.push(permName);
        } else if (hadPerm && !hasPerm) {
          removedPerms.push(permName);
        }
      }

      if (addedPerms.length > 0 || removedPerms.length > 0) {
        let permDiff = '';
        if (addedPerms.length > 0) {
          permDiff += `**Added:** ${addedPerms.join(', ')}\n`;
        }
        if (removedPerms.length > 0) {
          permDiff += `**Removed:** ${removedPerms.join(', ')}`;
        }

        changes.push({
          field: 'Permissions',
          before: `\`${oldRole.permissions.bitfield}\``,
          after: `\`${newRole.permissions.bitfield}\``,
        });
      }
    }

    if (changes.length === 0) return;

    const container = new ContainerBuilder().setAccentColor(newRole.color || getLogColor('roleUpdate'));
    addText(container, '### Role Updated');
    addSeparator(container, 'small');

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      {
        name: 'Role',
        value: `${newRole.toString()} (${newRole.id})`,
        inline: false,
      },
    ];

    for (const change of changes) {
      fields.push({
        name: change.field,
        value: formatDiff('Change', change.before, change.after),
        inline: false,
      });
    }

    addFields(container, fields);
    await sendLogEmbed(newRole.guild, container, config, 'roleUpdate');
  } catch (error) {
    logger.error('Error in roleUpdateHandler:', error);
  }
};

// ============================================================================
// SERVER EVENTS
// ============================================================================

const serverUpdateHandler = async (oldGuild: Guild, newGuild: Guild) => {
  try {
    const config = await getLoggingConfig(newGuild.id);
    if (!config || !isEventEnabled(config, 'serverUpdate')) return;

    const changes: Array<{ field: string; before: string; after: string }> = [];

    if (oldGuild.name !== newGuild.name) {
      changes.push({
        field: 'Server Name',
        before: oldGuild.name,
        after: newGuild.name,
      });
    }

    if ((oldGuild.icon || 'none') !== (newGuild.icon || 'none')) {
      changes.push({
        field: 'Icon',
        before: oldGuild.icon ? 'Present' : 'None',
        after: newGuild.icon ? 'Present' : 'None',
      });
    }

    if ((oldGuild.banner || 'none') !== (newGuild.banner || 'none')) {
      changes.push({
        field: 'Banner',
        before: oldGuild.banner ? 'Present' : 'None',
        after: newGuild.banner ? 'Present' : 'None',
      });
    }

    const verificationLevels: Record<number, string> = {
      0: 'None',
      1: 'Low',
      2: 'Medium',
      3: 'High',
      4: 'Very High',
    };

    if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
      changes.push({
        field: 'Verification Level',
        before: verificationLevels[oldGuild.verificationLevel],
        after: verificationLevels[newGuild.verificationLevel],
      });
    }

    const notificationLevels: Record<number, string> = {
      0: 'All Messages',
      1: 'Only Mentions',
    };

    if (oldGuild.defaultMessageNotifications !== newGuild.defaultMessageNotifications) {
      changes.push({
        field: 'Default Notifications',
        before: notificationLevels[oldGuild.defaultMessageNotifications],
        after: notificationLevels[newGuild.defaultMessageNotifications],
      });
    }

    if ((oldGuild.systemChannelId || 'none') !== (newGuild.systemChannelId || 'none')) {
      changes.push({
        field: 'System Channel',
        before: oldGuild.systemChannelId ? 'Set' : 'None',
        after: newGuild.systemChannelId ? 'Set' : 'None',
      });
    }

    if ((oldGuild.rulesChannelId || 'none') !== (newGuild.rulesChannelId || 'none')) {
      changes.push({
        field: 'Rules Channel',
        before: oldGuild.rulesChannelId ? 'Set' : 'None',
        after: newGuild.rulesChannelId ? 'Set' : 'None',
      });
    }

    if ((oldGuild.description || 'none') !== (newGuild.description || 'none')) {
      changes.push({
        field: 'Description',
        before: oldGuild.description || 'None',
        after: newGuild.description || 'None',
      });
    }

    if (changes.length === 0) return;

    const container = new ContainerBuilder().setAccentColor(getLogColor('serverUpdate'));
    addText(container, '### Server Updated');
    addSeparator(container, 'small');

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      {
        name: 'Server',
        value: newGuild.name,
        inline: false,
      },
    ];

    for (const change of changes) {
      fields.push({
        name: change.field,
        value: formatDiff('Change', change.before, change.after),
        inline: false,
      });
    }

    addFields(container, fields);
    await sendLogEmbed(newGuild, container, config, 'serverUpdate');
  } catch (error) {
    logger.error('Error in serverUpdateHandler:', error);
  }
};

const emojiUpdateHandler = async (oldEmoji: GuildEmoji | null, newEmoji: GuildEmoji | null) => {
  try {
    // Handle emoji creation
    if (!oldEmoji && newEmoji) {
      const config = await getLoggingConfig(newEmoji.guild.id);
      if (!config || !isEventEnabled(config, 'emojiUpdate')) return;


      let creator: GuildMember | null = null;
      try {
        const auditLogs = await newEmoji.guild.fetchAuditLogs({ type: AuditLogEvent.EmojiCreate, limit: 5 });
        const createLog = auditLogs.entries.find((entry) => entry.targetId === newEmoji.id);
        if (createLog?.executor) {
          creator = await newEmoji.guild.members.fetch(createLog.executor.id).catch(() => null);
        }
      } catch {
        // If audit log fetch fails, continue
      }

      const container = new ContainerBuilder().setAccentColor(getLogColor('emojiUpdate'));
      addSectionWithThumbnail(container, '### Emoji Created', newEmoji.url);
      addSeparator(container, 'small');

      const fields: Array<{ name: string; value: string; inline?: boolean }> = [
        { name: 'Emoji Name', value: newEmoji.name, inline: true },
        { name: 'Emoji ID', value: newEmoji.id, inline: true },
        { name: 'Animated', value: newEmoji.animated ? 'Yes' : 'No', inline: true },
      ];

      if (creator) {
        fields.push({
          name: 'Created By',
          value: `${creator.user.tag} (${creator.id})`,
          inline: false,
        });
      }

      addFields(container, fields);
      await sendLogEmbed(newEmoji.guild, container, config, 'emojiUpdate');
    }
    // Handle emoji deletion
    else if (oldEmoji && !newEmoji) {
      const config = await getLoggingConfig(oldEmoji.guild.id);
      if (!config || !isEventEnabled(config, 'emojiUpdate')) return;


      const container = new ContainerBuilder().setAccentColor(getLogColor('emojiUpdate'));
      addSectionWithThumbnail(container, '### Emoji Deleted', oldEmoji.url);
      addSeparator(container, 'small');

      const fields: Array<{ name: string; value: string; inline?: boolean }> = [
        { name: 'Emoji Name', value: oldEmoji.name, inline: true },
        { name: 'Emoji ID', value: oldEmoji.id, inline: true },
        { name: 'Was Animated', value: oldEmoji.animated ? 'Yes' : 'No', inline: true },
      ];

      addFields(container, fields);
      await sendLogEmbed(oldEmoji.guild, container, config, 'emojiUpdate');
    }
    // Handle emoji update
    else if (oldEmoji && newEmoji) {
      const config = await getLoggingConfig(newEmoji.guild.id);
      if (!config || !isEventEnabled(config, 'emojiUpdate')) return;


      const changes: Array<{ field: string; before: string; after: string }> = [];

      if (oldEmoji.name !== newEmoji.name) {
        changes.push({
          field: 'Name',
          before: oldEmoji.name,
          after: newEmoji.name,
        });
      }

      if (changes.length === 0) return;

      const container = new ContainerBuilder().setAccentColor(getLogColor('emojiUpdate'));
      addSectionWithThumbnail(container, '### Emoji Updated', newEmoji.url);
      addSeparator(container, 'small');

      const fields: Array<{ name: string; value: string; inline?: boolean }> = [
        {
          name: 'Emoji ID',
          value: newEmoji.id,
          inline: false,
        },
      ];

      for (const change of changes) {
        fields.push({
          name: change.field,
          value: formatDiff('Change', change.before, change.after),
          inline: false,
        });
      }

      addFields(container, fields);
      await sendLogEmbed(newEmoji.guild, container, config, 'emojiUpdate');
    }
  } catch (error) {
    logger.error('Error in emojiUpdateHandler:', error);
  }
};

const stickerUpdateHandler = async (oldSticker: Sticker | null, newSticker: Sticker | null) => {
  try {
    if (!oldSticker && !newSticker) return;

    const guild = oldSticker?.guild || newSticker?.guild;
    if (!guild) return;

    // Handle sticker creation
    if (!oldSticker && newSticker) {
      const config = await getLoggingConfig(guild.id);
      if (!config || !isEventEnabled(config, 'stickerUpdate')) return;


      let creator: GuildMember | null = null;
      try {
        const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.StickerCreate, limit: 5 });
        const createLog = auditLogs.entries.find((entry) => entry.targetId === newSticker.id);
        if (createLog?.executor) {
          creator = await guild.members.fetch(createLog.executor.id).catch(() => null);
        }
      } catch {
        // If audit log fetch fails, continue
      }

      const container = new ContainerBuilder().setAccentColor(getLogColor('stickerUpdate'));
      addText(container, '### Sticker Created');
      addSeparator(container, 'small');

      const fields: Array<{ name: string; value: string; inline?: boolean }> = [
        { name: 'Sticker Name', value: newSticker.name, inline: true },
        { name: 'Sticker ID', value: newSticker.id, inline: true },
        { name: 'Format', value: String(newSticker.format), inline: true },
      ];

      if (creator) {
        fields.push({
          name: 'Created By',
          value: `${creator.user.tag} (${creator.id})`,
          inline: false,
        });
      }

      addFields(container, fields);
      await sendLogEmbed(guild, container, config, 'stickerUpdate');
    }
    // Handle sticker deletion
    else if (oldSticker && !newSticker) {
      const config = await getLoggingConfig(guild.id);
      if (!config || !isEventEnabled(config, 'stickerUpdate')) return;

      const container = new ContainerBuilder().setAccentColor(getLogColor('stickerUpdate'));
      addText(container, '### Sticker Deleted');
      addSeparator(container, 'small');

      const fields: Array<{ name: string; value: string; inline?: boolean }> = [
        { name: 'Sticker Name', value: oldSticker.name, inline: true },
        { name: 'Sticker ID', value: oldSticker.id, inline: true },
        { name: 'Format', value: String(oldSticker.format), inline: true },
      ];

      addFields(container, fields);
      await sendLogEmbed(guild, container, config, 'stickerUpdate');
    }
    // Handle sticker update
    else if (oldSticker && newSticker) {
      const config = await getLoggingConfig(guild.id);
      if (!config || !isEventEnabled(config, 'stickerUpdate')) return;

      const changes: Array<{ field: string; before: string; after: string }> = [];

      if (oldSticker.name !== newSticker.name) {
        changes.push({
          field: 'Name',
          before: oldSticker.name,
          after: newSticker.name,
        });
      }

      if (oldSticker.description !== newSticker.description) {
        changes.push({
          field: 'Description',
          before: oldSticker.description || 'None',
          after: newSticker.description || 'None',
        });
      }

      if (changes.length === 0) return;

      const container = new ContainerBuilder().setAccentColor(getLogColor('stickerUpdate'));
      addText(container, '### Sticker Updated');
      addSeparator(container, 'small');

      const fields: Array<{ name: string; value: string; inline?: boolean }> = [
        {
          name: 'Sticker ID',
          value: newSticker.id,
          inline: false,
        },
      ];

      for (const change of changes) {
        fields.push({
          name: change.field,
          value: formatDiff('Change', change.before, change.after),
          inline: false,
        });
      }

      addFields(container, fields);
      await sendLogEmbed(guild, container, config, 'stickerUpdate');
    }
  } catch (error) {
    logger.error('Error in stickerUpdateHandler:', error);
  }
};

// ============================================================================
// INVITE EVENTS
// ============================================================================

const inviteCreateHandler = async (invite: Invite) => {
  try {
    if (!invite.guild || !invite.channel) return;

    const config = await getLoggingConfig(invite.guild.id);
    if (!config || !isEventEnabled(config, 'inviteCreate')) return;

    if (isIgnored(config, 'channel', invite.channel.id)) return;

    const container = new ContainerBuilder().setAccentColor(getLogColor('inviteCreate'));
    addText(container, '### Invite Created');
    addSeparator(container, 'small');

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: 'Invite Code', value: `\`${invite.code}\``, inline: true },
      { name: 'Channel', value: invite.channel.toString(), inline: true },
      { name: 'Inviter', value: invite.inviter?.tag || 'Unknown', inline: true },
    ];

    if (invite.maxUses) {
      fields.push({
        name: 'Max Uses',
        value: invite.maxUses.toString(),
        inline: true,
      });
    }

    if (invite.maxAge) {
      fields.push({
        name: 'Expires',
        value: `<t:${Math.floor((Date.now() + invite.maxAge * 1000) / 1000)}:R>`,
        inline: true,
      });
    }

    addFields(container, fields);
    await sendLogEmbed(invite.guild as Guild, container, config, 'inviteCreate');
  } catch (error) {
    logger.error('Error in inviteCreateHandler:', error);
  }
};

const inviteDeleteHandler = async (invite: Invite) => {
  try {
    if (!invite.guild || !invite.channel) return;

    const config = await getLoggingConfig(invite.guild.id);
    if (!config || !isEventEnabled(config, 'inviteDelete')) return;

    if (isIgnored(config, 'channel', invite.channel.id)) return;

    const container = new ContainerBuilder().setAccentColor(getLogColor('inviteDelete'));
    addText(container, '### Invite Deleted');
    addSeparator(container, 'small');

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: 'Invite Code', value: `\`${invite.code}\``, inline: true },
      { name: 'Channel', value: invite.channel.toString(), inline: true },
      { name: 'Inviter', value: invite.inviter?.tag || 'Unknown', inline: true },
    ];

    addFields(container, fields);
    await sendLogEmbed(invite.guild as Guild, container, config, 'inviteDelete');
  } catch (error) {
    logger.error('Error in inviteDeleteHandler:', error);
  }
};

// ============================================================================
// THREAD EVENTS
// ============================================================================

const threadCreateHandler = async (thread: ThreadChannel) => {
  try {
    if (!thread.guild) return;

    const config = await getLoggingConfig(thread.guild.id);
    if (!config || !isEventEnabled(config, 'threadCreate')) return;

    if (thread.parentId && isIgnored(config, "channel", thread.parentId)) return;

    const container = new ContainerBuilder().setAccentColor(getLogColor('threadCreate'));
    addText(container, '### Thread Created');
    addSeparator(container, 'small');

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: 'Thread Name', value: thread.name, inline: false },
      { name: 'Thread ID', value: thread.id, inline: true },
      { name: 'Parent Channel', value: thread.parent?.toString() || 'Unknown', inline: true },
    ];

    if (thread.ownerId) {
      try {
        const owner = await thread.guild.members.fetch(thread.ownerId);
        fields.push({
          name: 'Creator',
          value: `${owner.user.tag} (${owner.id})`,
          inline: false,
        });
      } catch {
        // If fetch fails, continue
      }
    }

    addFields(container, fields);
    await sendLogEmbed(thread.guild, container, config, 'threadCreate');
  } catch (error) {
    logger.error('Error in threadCreateHandler:', error);
  }
};

const threadDeleteHandler = async (thread: ThreadChannel) => {
  try {
    if (!thread.guild) return;

    const config = await getLoggingConfig(thread.guild.id);
    if (!config || !isEventEnabled(config, 'threadDelete')) return;

    if (thread.parentId && isIgnored(config, "channel", thread.parentId)) return;

    const container = new ContainerBuilder().setAccentColor(getLogColor('threadDelete'));
    addText(container, '### Thread Deleted');
    addSeparator(container, 'small');

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: 'Thread Name', value: thread.name, inline: true },
      { name: 'Thread ID', value: thread.id, inline: true },
      { name: 'Parent Channel', value: thread.parent?.toString() || 'Unknown', inline: false },
    ];

    addFields(container, fields);
    await sendLogEmbed(thread.guild, container, config, 'threadDelete');
  } catch (error) {
    logger.error('Error in threadDeleteHandler:', error);
  }
};

const threadArchiveHandler = async (oldThread: ThreadChannel, newThread: ThreadChannel) => {
  try {
    if (!newThread.guild) return;

    const config = await getLoggingConfig(newThread.guild.id);
    if (!config || !isEventEnabled(config, 'threadArchive')) return;

    if (newThread.parentId && isIgnored(config, "channel", newThread.parentId)) return;

    if (oldThread.archived === newThread.archived) return;

    const container = new ContainerBuilder().setAccentColor(getLogColor('threadArchive'));
    addText(container, `### ${newThread.archived ? 'Thread Archived' : 'Thread Unarchived'}`);
    addSeparator(container, 'small');

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: 'Thread Name', value: newThread.name, inline: false },
      { name: 'Thread ID', value: newThread.id, inline: true },
      { name: 'Parent Channel', value: newThread.parent?.toString() || 'Unknown', inline: true },
    ];

    addFields(container, fields);
    await sendLogEmbed(newThread.guild, container, config, 'threadArchive');
  } catch (error) {
    logger.error('Error in threadArchiveHandler:', error);
  }
};

// ============================================================================
// MODERATION EVENTS
// ============================================================================

const memberBanHandler = async (ban: GuildBan) => {
  try {
    const config = await getLoggingConfig(ban.guild.id);
    if (!config || !isEventEnabled(config, 'memberBan')) return;

    if (isIgnored(config, 'user', ban.user.id)) return;

    const container = new ContainerBuilder().setAccentColor(getLogColor('memberBan'));
    addSectionWithThumbnail(container, '### Member Banned', ban.user.displayAvatarURL({ size: 256 }));
    addSeparator(container, 'small');

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: 'Username', value: ban.user.tag, inline: true },
      { name: 'User ID', value: ban.user.id, inline: true },
      { name: 'Ban Reason', value: ban.reason || 'No reason provided', inline: false },
    ];

    addFields(container, fields);
    await sendLogEmbed(ban.guild, container, config, 'memberBan');
  } catch (error) {
    logger.error('Error in memberBanHandler:', error);
  }
};

const memberUnbanHandler = async (ban: GuildBan) => {
  try {
    const config = await getLoggingConfig(ban.guild.id);
    if (!config || !isEventEnabled(config, 'memberUnban')) return;

    if (isIgnored(config, 'user', ban.user.id)) return;

    const container = new ContainerBuilder().setAccentColor(getLogColor('memberUnban'));
    addSectionWithThumbnail(container, '### Member Unbanned', ban.user.displayAvatarURL({ size: 256 }));
    addSeparator(container, 'small');

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [
      { name: 'Username', value: ban.user.tag, inline: true },
      { name: 'User ID', value: ban.user.id, inline: true },
    ];

    addFields(container, fields);
    await sendLogEmbed(ban.guild, container, config, 'memberUnban');
  } catch (error) {
    logger.error('Error in memberUnbanHandler:', error);
  }
};

// ============================================================================
// VOICE EVENTS
// ============================================================================

const voiceStateHandler = async (oldState: VoiceState, newState: VoiceState) => {
  try {
    if (!newState.guild) return;

    const config = await getLoggingConfig(newState.guild.id);
    if (!config) return;

    if (isIgnored(config, 'user', newState.member?.id)) return;

    // Voice join
    if (!oldState.channel && newState.channel && isEventEnabled(config, 'voiceJoin')) {
      if (isIgnored(config, 'channel', newState.channel.id)) return;

      const container = new ContainerBuilder().setAccentColor(getLogColor('voiceJoin'));
      addSectionWithThumbnail(container, '### Voice Join', newState.member?.user.displayAvatarURL({ size: 256 }) || '');
      addSeparator(container, 'small');

      const fields: Array<{ name: string; value: string; inline?: boolean }> = [
        {
          name: 'Member',
          value: `${newState.member?.user.tag} (${newState.member?.id})`,
          inline: false,
        },
        { name: 'Channel', value: newState.channel.toString(), inline: true },
      ];

      addFields(container, fields);
      await sendLogEmbed(newState.guild, container, config, 'voiceJoin');
    }
    // Voice leave
    else if (oldState.channel && !newState.channel && isEventEnabled(config, 'voiceLeave')) {
      if (isIgnored(config, 'channel', oldState.channel.id)) return;

      const container = new ContainerBuilder().setAccentColor(getLogColor('voiceLeave'));
      addSectionWithThumbnail(container, '### Voice Leave', newState.member?.user.displayAvatarURL({ size: 256 }) || '');
      addSeparator(container, 'small');

      const fields: Array<{ name: string; value: string; inline?: boolean }> = [
        {
          name: 'Member',
          value: `${newState.member?.user.tag} (${newState.member?.id})`,
          inline: false,
        },
        { name: 'Channel', value: oldState.channel.toString(), inline: true },
      ];

      addFields(container, fields);
      await sendLogEmbed(newState.guild, container, config, 'voiceLeave');
    }
    // Voice move
    else if (
      oldState.channel &&
      newState.channel &&
      oldState.channel.id !== newState.channel.id &&
      isEventEnabled(config, 'voiceMove')
    ) {
      if (isIgnored(config, 'channel', oldState.channel.id) || isIgnored(config, 'channel', newState.channel.id))
        return;

      const container = new ContainerBuilder().setAccentColor(getLogColor('voiceMove'));
      addSectionWithThumbnail(container, '### Voice Move', newState.member?.user.displayAvatarURL({ size: 256 }) || '');
      addSeparator(container, 'small');

      const fields: Array<{ name: string; value: string; inline?: boolean }> = [
        {
          name: 'Member',
          value: `${newState.member?.user.tag} (${newState.member?.id})`,
          inline: false,
        },
        {
          name: 'Channels',
          value: formatDiff('Voice Channel', oldState.channel?.toString() || 'None', newState.channel?.toString() || 'None'),
          inline: false,
        },
      ];

      addFields(container, fields);
      await sendLogEmbed(newState.guild, container, config, 'voiceMove');
    }

    // Voice mute
    if (oldState.mute !== newState.mute && isEventEnabled(config, 'voiceMute')) {
      if (newState.channel && isIgnored(config, 'channel', newState.channel.id)) return;

      const container = new ContainerBuilder().setAccentColor(getLogColor('voiceMute'));
      addSectionWithThumbnail(container, `### ${newState.mute ? 'Voice Muted' : 'Voice Unmuted'}`, newState.member?.user.displayAvatarURL({ size: 256 }) || '');
      addSeparator(container, 'small');

      const fields: Array<{ name: string; value: string; inline?: boolean }> = [
        {
          name: 'Member',
          value: `${newState.member?.user.tag} (${newState.member?.id})`,
          inline: false,
        },
        { name: 'Status', value: newState.mute ? 'Muted' : 'Unmuted', inline: true },
      ];

      addFields(container, fields);
      await sendLogEmbed(newState.guild, container, config, 'voiceMute');
    }

    // Voice deafen
    if (oldState.deaf !== newState.deaf && isEventEnabled(config, 'voiceDeafen')) {
      if (newState.channel && isIgnored(config, 'channel', newState.channel.id)) return;

      const container = new ContainerBuilder().setAccentColor(getLogColor('voiceDeafen'));
      addSectionWithThumbnail(container, `### ${newState.deaf ? 'Voice Deafened' : 'Voice Undeafened'}`, newState.member?.user.displayAvatarURL({ size: 256 }) || '');
      addSeparator(container, 'small');

      const fields: Array<{ name: string; value: string; inline?: boolean }> = [
        {
          name: 'Member',
          value: `${newState.member?.user.tag} (${newState.member?.id})`,
          inline: false,
        },
        { name: 'Status', value: newState.deaf ? 'Deafened' : 'Undeafened', inline: true },
      ];

      addFields(container, fields);
      await sendLogEmbed(newState.guild, container, config, 'voiceDeafen');
    }
  } catch (error) {
    logger.error('Error in voiceStateHandler:', error);
  }
};

// ============================================================================
// MODULE EVENT EXPORTS
// ============================================================================

export const loggingEvents: ModuleEvent[] = [
  // Message events
  { event: Events.MessageUpdate, handler: messageEditHandler },
  { event: Events.MessageDelete, handler: messageDeleteHandler },
  { event: Events.MessageBulkDelete, handler: messageBulkDeleteHandler },
  { event: Events.ChannelPinsUpdate, handler: messagePinHandler },

  // Member events
  { event: Events.GuildMemberAdd, handler: memberJoinHandler },
  { event: Events.GuildMemberRemove, handler: memberLeaveHandler },
  { event: Events.GuildMemberUpdate, handler: memberRoleChangeHandler },
  { event: Events.GuildMemberUpdate, handler: memberNicknameHandler },
  { event: Events.GuildMemberUpdate, handler: memberTimeoutHandler },

  // Channel events
  { event: Events.ChannelCreate, handler: channelCreateHandler },
  { event: Events.ChannelDelete, handler: channelDeleteHandler },
  { event: Events.ChannelUpdate, handler: channelUpdateHandler },

  // Role events
  { event: Events.GuildRoleCreate, handler: roleCreateHandler },
  { event: Events.GuildRoleDelete, handler: roleDeleteHandler },
  { event: Events.GuildRoleUpdate, handler: roleUpdateHandler },

  // Server events
  { event: Events.GuildUpdate, handler: serverUpdateHandler },
  { event: Events.GuildEmojiCreate, handler: emojiUpdateHandler },
  { event: Events.GuildEmojiDelete, handler: emojiUpdateHandler },
  { event: Events.GuildEmojiUpdate, handler: emojiUpdateHandler },
  { event: Events.GuildStickerCreate, handler: stickerUpdateHandler },
  { event: Events.GuildStickerDelete, handler: stickerUpdateHandler },
  { event: Events.GuildStickerUpdate, handler: stickerUpdateHandler },

  // Invite events
  { event: Events.InviteCreate, handler: inviteCreateHandler },
  { event: Events.InviteDelete, handler: inviteDeleteHandler },

  // Thread events
  { event: Events.ThreadCreate, handler: threadCreateHandler },
  { event: Events.ThreadDelete, handler: threadDeleteHandler },
  { event: Events.ThreadUpdate, handler: threadArchiveHandler },

  // Moderation events
  { event: Events.GuildBanAdd, handler: memberBanHandler },
  { event: Events.GuildBanRemove, handler: memberUnbanHandler },

  // Voice events
  { event: Events.VoiceStateUpdate, handler: voiceStateHandler },
];
