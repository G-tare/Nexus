/**
 * Permission Management Tools — 3 tools for managing channel overwrites,
 * role permissions, and bot command permissions.
 */

import { ChannelType, PermissionFlagsBits, OverwriteType, Role, GuildChannel } from 'discord.js';
import { DiscordTool, ToolExecutionContext } from './registry';
import { permissionManager } from '../../../Shared/src/permissions/permissionManager';

/** Map friendly permission names to discord.js bits. */
const PERM_MAP: Record<string, bigint> = {
  view_channel: PermissionFlagsBits.ViewChannel,
  send_messages: PermissionFlagsBits.SendMessages,
  manage_messages: PermissionFlagsBits.ManageMessages,
  manage_channels: PermissionFlagsBits.ManageChannels,
  embed_links: PermissionFlagsBits.EmbedLinks,
  attach_files: PermissionFlagsBits.AttachFiles,
  add_reactions: PermissionFlagsBits.AddReactions,
  read_message_history: PermissionFlagsBits.ReadMessageHistory,
  mention_everyone: PermissionFlagsBits.MentionEveryone,
  connect: PermissionFlagsBits.Connect,
  speak: PermissionFlagsBits.Speak,
  use_vad: PermissionFlagsBits.UseVAD,
  mute_members: PermissionFlagsBits.MuteMembers,
  deafen_members: PermissionFlagsBits.DeafenMembers,
  move_members: PermissionFlagsBits.MoveMembers,
  create_invite: PermissionFlagsBits.CreateInstantInvite,
};

export const permissionTools: DiscordTool[] = [
  // ─────────────────────────────
  // 1. set_channel_permission
  // ─────────────────────────────
  {
    id: 'permissions.channel',
    category: 'permissions',
    name: 'Set Channel Permission',
    description: 'Set a permission override for a role or user on a specific channel. Use this to allow or deny specific permissions in a channel.',
    parameters: {
      type: 'object',
      properties: {
        channel_name: { type: 'string', description: 'Name of the channel' },
        target_type: { type: 'string', description: 'Whether the target is a role or user', enum: ['role', 'user'] },
        target_name: { type: 'string', description: 'Name of the role or username of the member' },
        permission: { type: 'string', description: 'Permission name: view_channel, send_messages, manage_messages, connect, speak, etc.' },
        action: { type: 'string', description: 'Whether to allow, deny, or reset (inherit) the permission', enum: ['allow', 'deny', 'reset'] },
      },
      required: ['channel_name', 'target_type', 'target_name', 'permission', 'action'],
    },
    isDestructive: false,
    requiredPermission: PermissionFlagsBits.ManageChannels,

    async execute(params, ctx) {
      const channelName = (params.channel_name as string).toLowerCase().replace(/^#/, '');
      const targetType = params.target_type as 'role' | 'user';
      const targetName = (params.target_name as string).toLowerCase();
      const permName = (params.permission as string).toLowerCase();
      const action = params.action as 'allow' | 'deny' | 'reset';

      const channel = ctx.guild.channels.cache.find(
        ch => ch.name.toLowerCase() === channelName,
      ) as GuildChannel | undefined;
      if (!channel) return `Error: Channel "${channelName}" not found.`;

      const permBit = PERM_MAP[permName];
      if (!permBit) {
        return `Error: Unknown permission "${permName}". Valid: ${Object.keys(PERM_MAP).join(', ')}`;
      }

      // Find target
      let targetId: string;
      if (targetType === 'role') {
        const role = ctx.guild.roles.cache.find(r => r.name.toLowerCase() === targetName);
        if (!role) return `Error: Role "${targetName}" not found.`;
        targetId = role.id;
      } else {
        const member = ctx.guild.members.cache.find(
          m => m.user.username.toLowerCase() === targetName || m.displayName.toLowerCase() === targetName,
        );
        if (!member) return `Error: Member "${targetName}" not found.`;
        targetId = member.id;
      }

      // Apply permission overwrite
      if (action === 'allow') {
        await channel.permissionOverwrites.edit(targetId, { [permBitToKey(permBit)]: true });
      } else if (action === 'deny') {
        await channel.permissionOverwrites.edit(targetId, { [permBitToKey(permBit)]: false });
      } else {
        await channel.permissionOverwrites.edit(targetId, { [permBitToKey(permBit)]: null });
      }

      return `Set ${permName} to "${action}" for ${targetType} "${targetName}" in #${channel.name}.`;
    },
  },

  // ─────────────────────────────
  // 2. set_role_permission
  // ─────────────────────────────
  {
    id: 'permissions.role',
    category: 'permissions',
    name: 'Set Role Permission',
    description: 'Add or remove a server-wide permission from a role.',
    parameters: {
      type: 'object',
      properties: {
        role_name: { type: 'string', description: 'Name of the role' },
        permission: { type: 'string', description: 'Permission name to toggle' },
        enabled: { type: 'string', description: 'Whether to enable or disable the permission', enum: ['true', 'false'] },
      },
      required: ['role_name', 'permission', 'enabled'],
    },
    isDestructive: false,
    requiredPermission: PermissionFlagsBits.ManageRoles,

    async execute(params, ctx) {
      const roleName = (params.role_name as string).toLowerCase();
      const permName = (params.permission as string).toLowerCase();
      const enabled = params.enabled === 'true';

      const role = ctx.guild.roles.cache.find(r => r.name.toLowerCase() === roleName);
      if (!role) return `Error: Role "${roleName}" not found.`;

      const permBit = PERM_MAP[permName];
      if (!permBit) {
        return `Error: Unknown permission "${permName}". Valid: ${Object.keys(PERM_MAP).join(', ')}`;
      }

      const currentPerms = role.permissions.bitfield;
      const newPerms = enabled
        ? currentPerms | permBit
        : currentPerms & ~permBit;

      await role.setPermissions(newPerms);
      return `${enabled ? 'Enabled' : 'Disabled'} "${permName}" for role "${role.name}".`;
    },
  },

  // ─────────────────────────────
  // 3. set_command_permission
  // ─────────────────────────────
  {
    id: 'permissions.command',
    category: 'permissions',
    name: 'Set Command Permission',
    description: 'Allow or deny a user or role from using a specific bot command. Uses the bot\'s internal permission system (permissionPath).',
    parameters: {
      type: 'object',
      properties: {
        command_path: { type: 'string', description: 'Command permission path, e.g. "moderation.ban", "fun.8ball", "leveling.rank"' },
        target_type: { type: 'string', description: 'Whether the target is a role or user', enum: ['role', 'user'] },
        target_name: { type: 'string', description: 'Name of the role or username of the member' },
        allowed: { type: 'string', description: 'Allow or deny', enum: ['true', 'false'] },
      },
      required: ['command_path', 'target_type', 'target_name', 'allowed'],
    },
    isDestructive: false,
    requiredPermission: PermissionFlagsBits.ManageGuild,

    async execute(params, ctx) {
      const commandPath = params.command_path as string;
      const targetType = params.target_type as 'role' | 'user';
      const targetName = (params.target_name as string).toLowerCase();
      const allowed = params.allowed === 'true';

      let targetId: string;
      if (targetType === 'role') {
        const role = ctx.guild.roles.cache.find(r => r.name.toLowerCase() === targetName);
        if (!role) return `Error: Role "${targetName}" not found.`;
        targetId = role.id;
      } else {
        const member = ctx.guild.members.cache.find(
          m => m.user.username.toLowerCase() === targetName || m.displayName.toLowerCase() === targetName,
        );
        if (!member) return `Error: Member "${targetName}" not found.`;
        targetId = member.id;
      }

      await permissionManager.setPermission(ctx.guild.id, commandPath, targetType, targetId, allowed);
      return `Set command "${commandPath}" to ${allowed ? 'ALLOW' : 'DENY'} for ${targetType} "${targetName}".`;
    },
  },
];

/**
 * Convert a permission bit to the discord.js PermissionOverwriteOptions key.
 * e.g. PermissionFlagsBits.ViewChannel → 'ViewChannel'
 */
function permBitToKey(bit: bigint): string {
  for (const [key, value] of Object.entries(PermissionFlagsBits)) {
    if (value === bit) return key;
  }
  return 'ViewChannel';
}
