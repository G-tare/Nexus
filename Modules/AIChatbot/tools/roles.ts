/**
 * Role Management Tools — 7 tools for creating, editing, deleting,
 * and assigning roles.
 */

import { PermissionFlagsBits, PermissionsBitField, ColorResolvable } from 'discord.js';
import { DiscordTool, ToolExecutionContext } from './registry';

/** Resolve a color string like "blue", "#ff0000", "red" to a hex number. */
function resolveColor(input: string): number | null {
  const named: Record<string, number> = {
    red: 0xE74C3C, blue: 0x3498DB, green: 0x2ECC71, yellow: 0xF1C40F,
    orange: 0xE67E22, purple: 0x9B59B6, pink: 0xE91E63, white: 0xFFFFFF,
    black: 0x000000, gray: 0x95A5A6, grey: 0x95A5A6, cyan: 0x1ABC9C,
    gold: 0xF1C40F, teal: 0x1ABC9C, navy: 0x34495E, aqua: 0x00FFFF,
  };
  const lower = input.toLowerCase().trim();
  if (named[lower] !== undefined) return named[lower];
  if (/^#?[0-9a-f]{6}$/i.test(lower)) return parseInt(lower.replace('#', ''), 16);
  return null;
}

/** Map string permission names to discord.js permission bits. */
const PERM_MAP: Record<string, bigint> = {
  manage_channels: PermissionFlagsBits.ManageChannels,
  manage_roles: PermissionFlagsBits.ManageRoles,
  manage_messages: PermissionFlagsBits.ManageMessages,
  manage_server: PermissionFlagsBits.ManageGuild,
  manage_nicknames: PermissionFlagsBits.ManageNicknames,
  kick_members: PermissionFlagsBits.KickMembers,
  ban_members: PermissionFlagsBits.BanMembers,
  mention_everyone: PermissionFlagsBits.MentionEveryone,
  send_messages: PermissionFlagsBits.SendMessages,
  embed_links: PermissionFlagsBits.EmbedLinks,
  attach_files: PermissionFlagsBits.AttachFiles,
  add_reactions: PermissionFlagsBits.AddReactions,
  use_external_emojis: PermissionFlagsBits.UseExternalEmojis,
  connect: PermissionFlagsBits.Connect,
  speak: PermissionFlagsBits.Speak,
  mute_members: PermissionFlagsBits.MuteMembers,
  deafen_members: PermissionFlagsBits.DeafenMembers,
  move_members: PermissionFlagsBits.MoveMembers,
  administrator: PermissionFlagsBits.Administrator,
  view_channels: PermissionFlagsBits.ViewChannel,
  read_message_history: PermissionFlagsBits.ReadMessageHistory,
  manage_webhooks: PermissionFlagsBits.ManageWebhooks,
  manage_emojis: PermissionFlagsBits.ManageEmojisAndStickers,
  create_invite: PermissionFlagsBits.CreateInstantInvite,
};

export const roleTools: DiscordTool[] = [
  // ─────────────────────────────
  // 1. create_role
  // ─────────────────────────────
  {
    id: 'roles.create',
    category: 'roles',
    name: 'Create Role',
    description: 'Create a new role with a name, color, and optional permissions. Permissions are a comma-separated list like "manage_messages,kick_members".',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Role name' },
        color: { type: 'string', description: 'Color name (red, blue, green, etc.) or hex code (#ff0000)' },
        hoist: { type: 'string', description: 'Show role members separately in sidebar', enum: ['true', 'false'] },
        mentionable: { type: 'string', description: 'Allow anyone to @mention this role', enum: ['true', 'false'] },
        permissions: { type: 'string', description: 'Comma-separated permission names: manage_channels, manage_roles, manage_messages, manage_server, kick_members, ban_members, send_messages, connect, speak, administrator, view_channels, etc.' },
      },
      required: ['name'],
    },
    isDestructive: false,
    requiredPermission: PermissionFlagsBits.ManageRoles,

    async execute(params, ctx) {
      const name = params.name as string;
      const colorStr = params.color as string | undefined;
      const hoist = params.hoist === 'true';
      const mentionable = params.mentionable === 'true';

      let color: ColorResolvable = 0x99AAB5; // Default grey
      if (colorStr) {
        const resolved = resolveColor(colorStr);
        if (resolved !== null) color = resolved;
      }

      // Parse permissions
      let permBits: bigint | undefined;
      if (params.permissions) {
        const permNames = (params.permissions as string).split(',').map(p => p.trim().toLowerCase());
        let bits = BigInt(0);
        const invalid: string[] = [];
        for (const p of permNames) {
          if (PERM_MAP[p]) bits |= PERM_MAP[p];
          else invalid.push(p);
        }
        if (invalid.length > 0) {
          return `Error: Unknown permissions: ${invalid.join(', ')}. Valid: ${Object.keys(PERM_MAP).join(', ')}`;
        }
        permBits = bits;
      }

      const role = await ctx.guild.roles.create({
        name,
        color,
        hoist,
        mentionable,
        permissions: permBits !== undefined ? new PermissionsBitField(permBits) : undefined,
      });

      return `Created role "${role.name}" (ID: ${role.id}, color: ${typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : color}).`;
    },
  },

  // ─────────────────────────────
  // 2. delete_role
  // ─────────────────────────────
  {
    id: 'roles.delete',
    category: 'roles',
    name: 'Delete Role',
    description: 'Delete a role from the server. This is IRREVERSIBLE.',
    parameters: {
      type: 'object',
      properties: {
        role_name: { type: 'string', description: 'Name of the role to delete' },
      },
      required: ['role_name'],
    },
    isDestructive: true,
    requiredPermission: PermissionFlagsBits.ManageRoles,

    async execute(params, ctx) {
      const name = (params.role_name as string).toLowerCase();
      const role = ctx.guild.roles.cache.find(r => r.name.toLowerCase() === name && !r.managed && r.id !== ctx.guild.id);
      if (!role) return `Error: Role "${name}" not found. Available roles: ${ctx.guild.roles.cache.filter(r => !r.managed && r.id !== ctx.guild.id).map(r => r.name).join(', ')}`;

      const roleName = role.name;
      await role.delete();
      return `Deleted role "${roleName}".`;
    },
  },

  // ─────────────────────────────
  // 3. edit_role
  // ─────────────────────────────
  {
    id: 'roles.edit',
    category: 'roles',
    name: 'Edit Role',
    description: 'Edit a role\'s name, color, hoist, or mentionable settings.',
    parameters: {
      type: 'object',
      properties: {
        role_name: { type: 'string', description: 'Current name of the role to edit' },
        new_name: { type: 'string', description: 'New name (optional)' },
        color: { type: 'string', description: 'New color name or hex (optional)' },
        hoist: { type: 'string', description: 'Show separately in sidebar', enum: ['true', 'false'] },
        mentionable: { type: 'string', description: 'Allow @mentions', enum: ['true', 'false'] },
      },
      required: ['role_name'],
    },
    isDestructive: false,
    requiredPermission: PermissionFlagsBits.ManageRoles,

    async execute(params, ctx) {
      const name = (params.role_name as string).toLowerCase();
      const role = ctx.guild.roles.cache.find(r => r.name.toLowerCase() === name);
      if (!role) return `Error: Role "${name}" not found.`;

      const updates: Record<string, unknown> = {};
      if (params.new_name) updates.name = params.new_name as string;
      if (params.color) {
        const resolved = resolveColor(params.color as string);
        if (resolved !== null) updates.color = resolved;
      }
      if (params.hoist !== undefined) updates.hoist = params.hoist === 'true';
      if (params.mentionable !== undefined) updates.mentionable = params.mentionable === 'true';

      if (Object.keys(updates).length === 0) return 'No changes specified.';

      await role.edit(updates);
      return `Updated role "${role.name}": changed ${Object.keys(updates).join(', ')}.`;
    },
  },

  // ─────────────────────────────
  // 4. assign_role
  // ─────────────────────────────
  {
    id: 'roles.assign',
    category: 'roles',
    name: 'Assign Role',
    description: 'Give a role to a member.',
    parameters: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'Username or display name of the member' },
        role_name: { type: 'string', description: 'Name of the role to assign' },
      },
      required: ['username', 'role_name'],
    },
    isDestructive: false,
    requiredPermission: PermissionFlagsBits.ManageRoles,

    async execute(params, ctx) {
      const username = (params.username as string).toLowerCase();
      const roleName = (params.role_name as string).toLowerCase();

      const member = ctx.guild.members.cache.find(
        m => m.user.username.toLowerCase() === username ||
             m.displayName.toLowerCase() === username ||
             m.user.tag.toLowerCase() === username,
      );
      if (!member) return `Error: Member "${username}" not found.`;

      const role = ctx.guild.roles.cache.find(r => r.name.toLowerCase() === roleName);
      if (!role) return `Error: Role "${roleName}" not found.`;

      if (member.roles.cache.has(role.id)) {
        return `${member.displayName} already has the "${role.name}" role.`;
      }

      await member.roles.add(role);
      return `Assigned role "${role.name}" to ${member.displayName}.`;
    },
  },

  // ─────────────────────────────
  // 5. remove_role
  // ─────────────────────────────
  {
    id: 'roles.remove',
    category: 'roles',
    name: 'Remove Role',
    description: 'Remove a role from a member.',
    parameters: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'Username or display name of the member' },
        role_name: { type: 'string', description: 'Name of the role to remove' },
      },
      required: ['username', 'role_name'],
    },
    isDestructive: false,
    requiredPermission: PermissionFlagsBits.ManageRoles,

    async execute(params, ctx) {
      const username = (params.username as string).toLowerCase();
      const roleName = (params.role_name as string).toLowerCase();

      const member = ctx.guild.members.cache.find(
        m => m.user.username.toLowerCase() === username || m.displayName.toLowerCase() === username,
      );
      if (!member) return `Error: Member "${username}" not found.`;

      const role = ctx.guild.roles.cache.find(r => r.name.toLowerCase() === roleName);
      if (!role) return `Error: Role "${roleName}" not found.`;

      if (!member.roles.cache.has(role.id)) {
        return `${member.displayName} does not have the "${role.name}" role.`;
      }

      await member.roles.remove(role);
      return `Removed role "${role.name}" from ${member.displayName}.`;
    },
  },

  // ─────────────────────────────
  // 6. list_roles
  // ─────────────────────────────
  {
    id: 'roles.list',
    category: 'roles',
    name: 'List Roles',
    description: 'List all roles in the server with their colors and member counts.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    isDestructive: false,
    requiredPermission: null,

    async execute(_params, ctx) {
      const roles = ctx.guild.roles.cache
        .filter(r => r.id !== ctx.guild.id) // Exclude @everyone
        .sort((a, b) => b.position - a.position);

      if (roles.size === 0) return 'No custom roles in this server.';

      const lines = roles.map(r => {
        const color = r.hexColor !== '#000000' ? r.hexColor : 'default';
        const members = r.members.size;
        const managed = r.managed ? ' [bot/integration]' : '';
        return `• ${r.name} — ${color}, ${members} members${managed}`;
      });

      return `Server Roles (${roles.size}):\n${lines.join('\n')}`;
    },
  },

  // ─────────────────────────────
  // 7. get_role_info
  // ─────────────────────────────
  {
    id: 'roles.info',
    category: 'roles',
    name: 'Get Role Info',
    description: 'Get detailed information about a specific role including its permissions.',
    parameters: {
      type: 'object',
      properties: {
        role_name: { type: 'string', description: 'Name of the role' },
      },
      required: ['role_name'],
    },
    isDestructive: false,
    requiredPermission: null,

    async execute(params, ctx) {
      const name = (params.role_name as string).toLowerCase();
      const role = ctx.guild.roles.cache.find(r => r.name.toLowerCase() === name);
      if (!role) return `Error: Role "${name}" not found.`;

      const perms = role.permissions.toArray();

      return [
        `Role: ${role.name}`,
        `ID: ${role.id}`,
        `Color: ${role.hexColor}`,
        `Position: ${role.position}`,
        `Hoisted: ${role.hoist}`,
        `Mentionable: ${role.mentionable}`,
        `Managed: ${role.managed}`,
        `Members: ${role.members.size}`,
        `Permissions: ${perms.length > 0 ? perms.join(', ') : 'None'}`,
      ].join('\n');
    },
  },
];
