/**
 * Server Management Tools — 5 tools for editing server settings,
 * managing emojis, and viewing member info.
 */

import { PermissionFlagsBits, GuildMember } from 'discord.js';
import { DiscordTool, ToolExecutionContext } from './registry';

export const serverTools: DiscordTool[] = [
  // ─────────────────────────────
  // 1. edit_server
  // ─────────────────────────────
  {
    id: 'server.edit',
    category: 'server',
    name: 'Edit Server',
    description: 'Edit the server\'s name or description.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'New server name (optional)' },
        description: { type: 'string', description: 'New server description (optional, Community servers only)' },
      },
      required: [],
    },
    isDestructive: false,
    requiredPermission: PermissionFlagsBits.ManageGuild,

    async execute(params, ctx) {
      const updates: Record<string, unknown> = {};
      if (params.name) updates.name = params.name as string;
      if (params.description !== undefined) updates.description = params.description as string;

      if (Object.keys(updates).length === 0) return 'No changes specified.';

      await ctx.guild.edit(updates);
      return `Updated server: changed ${Object.keys(updates).join(', ')}.`;
    },
  },

  // ─────────────────────────────
  // 2. get_server_info
  // ─────────────────────────────
  {
    id: 'server.info',
    category: 'server',
    name: 'Get Server Info',
    description: 'Get detailed information about the server — name, member count, boost level, channels, roles, features.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    isDestructive: false,
    requiredPermission: null,

    async execute(_params, ctx) {
      const g = ctx.guild;
      const channels = g.channels.cache;
      const textCount = channels.filter(ch => ch.isTextBased() && !ch.isThread() && !ch.isDMBased()).size;
      const voiceCount = channels.filter(ch => ch.isVoiceBased()).size;
      const categoryCount = channels.filter(ch => ch.type === 4).size;
      const features = g.features.length > 0 ? g.features.map(f => f.toLowerCase().replace(/_/g, ' ')).join(', ') : 'none';

      return [
        `Server: ${g.name}`,
        `ID: ${g.id}`,
        `Owner: <@${g.ownerId}>`,
        `Members: ${g.memberCount}`,
        `Boost Level: ${g.premiumTier} (${g.premiumSubscriptionCount ?? 0} boosts)`,
        `Channels: ${textCount} text, ${voiceCount} voice, ${categoryCount} categories`,
        `Roles: ${g.roles.cache.size - 1}`, // -1 for @everyone
        `Emojis: ${g.emojis.cache.size}`,
        `Features: ${features}`,
        `Created: ${g.createdAt.toISOString().split('T')[0]}`,
        g.description ? `Description: ${g.description}` : '',
      ].filter(Boolean).join('\n');
    },
  },

  // ─────────────────────────────
  // 3. create_emoji
  // ─────────────────────────────
  {
    id: 'server.create_emoji',
    category: 'server',
    name: 'Create Emoji',
    description: 'Add a custom emoji to the server from a URL.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Emoji name (alphanumeric and underscores only)' },
        image_url: { type: 'string', description: 'URL of the image to use (PNG, JPG, GIF, max 256KB)' },
      },
      required: ['name', 'image_url'],
    },
    isDestructive: false,
    requiredPermission: PermissionFlagsBits.ManageEmojisAndStickers,

    async execute(params, ctx) {
      const name = (params.name as string).replace(/[^a-zA-Z0-9_]/g, '_');
      const url = params.image_url as string;

      try {
        const emoji = await ctx.guild.emojis.create({ attachment: url, name });
        return `Created emoji :${emoji.name}: (ID: ${emoji.id}).`;
      } catch (err) {
        return `Error creating emoji: ${err instanceof Error ? err.message : String(err)}. The image may be too large (max 256KB) or the server may have reached its emoji limit.`;
      }
    },
  },

  // ─────────────────────────────
  // 4. delete_emoji
  // ─────────────────────────────
  {
    id: 'server.delete_emoji',
    category: 'server',
    name: 'Delete Emoji',
    description: 'Remove a custom emoji from the server.',
    parameters: {
      type: 'object',
      properties: {
        emoji_name: { type: 'string', description: 'Name of the emoji to delete' },
      },
      required: ['emoji_name'],
    },
    isDestructive: true,
    requiredPermission: PermissionFlagsBits.ManageEmojisAndStickers,

    async execute(params, ctx) {
      const name = (params.emoji_name as string).toLowerCase();
      const emoji = ctx.guild.emojis.cache.find(e => e.name?.toLowerCase() === name);
      if (!emoji) {
        return `Error: Emoji "${name}" not found. Available: ${ctx.guild.emojis.cache.map(e => e.name).join(', ') || 'none'}`;
      }

      const emojiName = emoji.name;
      await emoji.delete();
      return `Deleted emoji :${emojiName}:.`;
    },
  },

  // ─────────────────────────────
  // 5. get_member_info
  // ─────────────────────────────
  {
    id: 'server.member_info',
    category: 'server',
    name: 'Get Member Info',
    description: 'Get information about a specific server member — roles, join date, permissions.',
    parameters: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'Username or display name of the member' },
      },
      required: ['username'],
    },
    isDestructive: false,
    requiredPermission: null,

    async execute(params, ctx) {
      const username = (params.username as string).toLowerCase();
      let member: GuildMember | undefined;

      // Try cache first
      member = ctx.guild.members.cache.find(
        m => m.user.username.toLowerCase() === username ||
             m.displayName.toLowerCase() === username ||
             m.user.tag.toLowerCase() === username,
      );

      // Fetch if not cached
      if (!member) {
        try {
          const fetched = await ctx.guild.members.search({ query: params.username as string, limit: 1 });
          member = fetched.first();
        } catch {
          // ignore
        }
      }

      if (!member) return `Error: Member "${username}" not found.`;

      const roles = member.roles.cache
        .filter(r => r.id !== ctx.guild.id)
        .sort((a, b) => b.position - a.position)
        .map(r => r.name);

      const keyPerms = member.permissions.toArray().filter(p =>
        ['Administrator', 'ManageGuild', 'ManageChannels', 'ManageRoles', 'ManageMessages',
         'KickMembers', 'BanMembers', 'MentionEveryone'].includes(p),
      );

      return [
        `Member: ${member.user.username} (${member.displayName})`,
        `ID: ${member.id}`,
        `Bot: ${member.user.bot}`,
        `Joined: ${member.joinedAt?.toISOString().split('T')[0] ?? 'unknown'}`,
        `Account Created: ${member.user.createdAt.toISOString().split('T')[0]}`,
        `Roles (${roles.length}): ${roles.join(', ') || 'none'}`,
        `Key Permissions: ${keyPerms.length > 0 ? keyPerms.join(', ') : 'none'}`,
        `Boosting: ${member.premiumSince ? 'Yes' : 'No'}`,
      ].join('\n');
    },
  },
];
