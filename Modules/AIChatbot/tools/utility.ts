/**
 * Utility / Read-Only Tools — 5 tools for gathering information about
 * the server without making any changes. The AI uses these to understand
 * the current state before taking actions.
 */

import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { DiscordTool, ToolExecutionContext } from './registry';
import { moduleConfig } from '../../../Shared/src/middleware/moduleConfig';

export const utilityTools: DiscordTool[] = [
  // ─────────────────────────────
  // 1. list_modules
  // ─────────────────────────────
  {
    id: 'utility.list_modules',
    category: 'utility',
    name: 'List Modules',
    description: 'List all available Nexus bot modules and whether they are enabled or disabled in this server.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    isDestructive: false,
    requiredPermission: null,

    async execute(_params, ctx) {
      // Get all modules from the client
      const client = ctx.client;
      const modules = (client as any).modules as Map<string, { name: string; displayName: string; description: string; category: string }> | undefined;

      if (!modules || modules.size === 0) {
        return 'No modules loaded.';
      }

      const lines: string[] = [];
      for (const [, mod] of modules) {
        const enabled = await moduleConfig.isEnabled(ctx.guild.id, mod.name);
        const icon = enabled ? '✅' : '❌';
        lines.push(`${icon} ${mod.displayName} (${mod.name}) — ${mod.description}`);
      }

      return `Nexus Bot Modules (${modules.size}):\n${lines.join('\n')}`;
    },
  },

  // ─────────────────────────────
  // 2. get_channel_info
  // ─────────────────────────────
  {
    id: 'utility.channel_info',
    category: 'utility',
    name: 'Get Channel Info',
    description: 'Get detailed information about a specific channel — type, topic, position, permissions overwrites.',
    parameters: {
      type: 'object',
      properties: {
        channel_name: { type: 'string', description: 'Name of the channel' },
      },
      required: ['channel_name'],
    },
    isDestructive: false,
    requiredPermission: null,

    async execute(params, ctx) {
      const name = (params.channel_name as string).toLowerCase().replace(/^#/, '');
      const channel = ctx.guild.channels.cache.find(ch => ch.name.toLowerCase() === name);

      if (!channel) return `Error: Channel "${name}" not found.`;

      const typeNames: Record<number, string> = {
        [ChannelType.GuildText]: 'Text',
        [ChannelType.GuildVoice]: 'Voice',
        [ChannelType.GuildCategory]: 'Category',
        [ChannelType.GuildAnnouncement]: 'Announcement',
        [ChannelType.GuildStageVoice]: 'Stage',
        [ChannelType.GuildForum]: 'Forum',
      };

      const overwrites = 'permissionOverwrites' in channel ? channel.permissionOverwrites?.cache : undefined;
      const overwriteLines: string[] = [];
      if (overwrites) {
        for (const [, ow] of overwrites) {
          const target = ow.type === 0
            ? ctx.guild.roles.cache.get(ow.id)?.name ?? ow.id
            : ctx.guild.members.cache.get(ow.id)?.displayName ?? ow.id;
          const allows = ow.allow.toArray();
          const denies = ow.deny.toArray();
          if (allows.length > 0 || denies.length > 0) {
            overwriteLines.push(`  ${target}: allow=[${allows.join(',')}] deny=[${denies.join(',')}]`);
          }
        }
      }

      const topic = 'topic' in channel ? (channel as any).topic : null;
      const nsfw = 'nsfw' in channel ? (channel as any).nsfw : false;
      const position = 'position' in channel ? (channel as any).position : null;
      const parent = channel.parent;

      return [
        `Channel: #${channel.name}`,
        `ID: ${channel.id}`,
        `Type: ${typeNames[channel.type] ?? channel.type}`,
        position !== null ? `Position: ${position}` : '',
        parent ? `Category: ${parent.name}` : 'Category: none',
        topic ? `Topic: ${topic}` : '',
        `NSFW: ${nsfw}`,
        overwriteLines.length > 0 ? `Permission Overwrites:\n${overwriteLines.join('\n')}` : 'Permission Overwrites: none',
      ].filter(Boolean).join('\n');
    },
  },

  // ─────────────────────────────
  // 3. search_members
  // ─────────────────────────────
  {
    id: 'utility.search_members',
    category: 'utility',
    name: 'Search Members',
    description: 'Search for members by username or display name. Returns up to 10 results.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (username or display name)' },
      },
      required: ['query'],
    },
    isDestructive: false,
    requiredPermission: null,

    async execute(params, ctx) {
      const query = params.query as string;

      const results = await ctx.guild.members.search({ query, limit: 10 });
      if (results.size === 0) return `No members found matching "${query}".`;

      const lines = results.map(m => {
        const roles = m.roles.cache.filter(r => r.id !== ctx.guild.id).map(r => r.name);
        return `• ${m.user.username} (${m.displayName}) — ${roles.length > 0 ? roles.slice(0, 3).join(', ') : 'no roles'}`;
      });

      return `Members matching "${query}" (${results.size}):\n${lines.join('\n')}`;
    },
  },

  // ─────────────────────────────
  // 4. get_bot_permissions
  // ─────────────────────────────
  {
    id: 'utility.bot_permissions',
    category: 'utility',
    name: 'Get Bot Permissions',
    description: 'Check what permissions the bot has in this server. Useful before attempting actions to avoid errors.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    isDestructive: false,
    requiredPermission: null,

    async execute(_params, ctx) {
      const botMember = ctx.guild.members.me;
      if (!botMember) return 'Error: Could not find bot member in this server.';

      const perms = botMember.permissions.toArray();
      const hasAdmin = perms.includes('Administrator');

      return [
        `Bot: ${botMember.user.username}`,
        `Highest Role: ${botMember.roles.highest.name} (position ${botMember.roles.highest.position})`,
        hasAdmin ? 'Permissions: Administrator (all permissions)' : `Permissions: ${perms.join(', ')}`,
      ].join('\n');
    },
  },

  // ─────────────────────────────
  // 5. get_user_permissions
  // ─────────────────────────────
  {
    id: 'utility.user_permissions',
    category: 'utility',
    name: 'Get User Permissions',
    description: 'Check what permissions the requesting user has. Useful to understand what actions are available.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    isDestructive: false,
    requiredPermission: null,

    async execute(_params, ctx) {
      const perms = ctx.member.permissions.toArray();
      const hasAdmin = perms.includes('Administrator');

      return [
        `User: ${ctx.member.user.username} (${ctx.member.displayName})`,
        `Highest Role: ${ctx.member.roles.highest.name}`,
        hasAdmin ? 'Permissions: Administrator (all permissions)' : `Permissions: ${perms.join(', ')}`,
        `Is Server Owner: ${ctx.guild.ownerId === ctx.member.id}`,
      ].join('\n');
    },
  },
];
